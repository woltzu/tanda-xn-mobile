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
import { useElder, VouchRequest, ActiveVouch, VouchHistory } from "../context/ElderContext";

type RootStackParamList = {
  VouchSystem: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = "requests" | "active" | "history";

export default function VouchSystemScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    elderProfile,
    elderStats,
    vouchRequests,
    activeVouches,
    vouchHistory,
    respondToVouchRequest,
    getVouchRiskAssessment,
    getElderTierInfo,
    isLoading,
  } = useElder();

  const [activeTab, setActiveTab] = useState<TabType>("requests");

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "requests", label: "Requests", count: vouchRequests.length },
    { key: "active", label: "Active", count: activeVouches.length },
    { key: "history", label: "History" },
  ];

  const handleApproveVouch = (request: VouchRequest) => {
    Alert.alert(
      "Approve Vouch Request",
      `Are you sure you want to vouch for ${request.requesterName}?\n\nThis will use ${request.requestedPoints} of your vouch points and your Honor Score may be affected if they default.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () => respondToVouchRequest(request.id, true),
        },
      ]
    );
  };

  const handleDeclineVouch = (request: VouchRequest) => {
    Alert.alert(
      "Decline Vouch Request",
      `Are you sure you want to decline ${request.requesterName}'s request?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: () => respondToVouchRequest(request.id, false),
        },
      ]
    );
  };

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "low":
        return "#00C6AE";
      case "medium":
        return "#D97706";
      case "high":
        return "#DC2626";
      default:
        return "#6B7280";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "on_track":
        return "#00C6AE";
      case "at_risk":
        return "#D97706";
      case "defaulted":
        return "#DC2626";
      default:
        return "#6B7280";
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case "on_track":
        return "On Track";
      case "at_risk":
        return "At Risk";
      case "defaulted":
        return "Defaulted";
      default:
        return status;
    }
  };

  const renderVouchStats = () => {
    if (!elderStats || !elderProfile) return null;

    const tierInfo = getElderTierInfo(elderProfile.tier);

    return (
      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <View style={styles.elderBadge}>
            <Text style={styles.elderBadgeIcon}>{tierInfo.icon}</Text>
            <Text style={[styles.elderBadgeText, { color: tierInfo.bg }]}>
              {elderProfile.tier} Elder
            </Text>
          </View>
          <View style={styles.vouchStrength}>
            <Text style={styles.vouchStrengthLabel}>Vouch Strength</Text>
            <Text style={styles.vouchStrengthValue}>
              {tierInfo.vouchStrength} pts
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{elderStats.vouchesAvailable}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{elderStats.activeVouches}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#00C6AE" }]}>
              {elderStats.successfulVouches}
            </Text>
            <Text style={styles.statLabel}>Successful</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#DC2626" }]}>
              {elderStats.defaultedVouches}
            </Text>
            <Text style={styles.statLabel}>Defaulted</Text>
          </View>
        </View>

        <View style={styles.vouchCapacity}>
          <View style={styles.capacityHeader}>
            <Text style={styles.capacityLabel}>Monthly Vouch Capacity</Text>
            <Text style={styles.capacityValue}>
              {elderStats.vouchesUsedThisMonth}/{elderStats.maxVouches} used
            </Text>
          </View>
          <View style={styles.capacityBar}>
            <View
              style={[
                styles.capacityFill,
                {
                  width: `${(elderStats.vouchesUsedThisMonth / elderStats.maxVouches) * 100}%`,
                },
              ]}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderRequestCard = (request: VouchRequest) => {
    const riskAssessment = getVouchRiskAssessment(request);

    return (
      <View key={request.id} style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.requesterInfo}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {request.requesterName.charAt(0)}
              </Text>
            </View>
            <View>
              <Text style={styles.requesterName}>{request.requesterName}</Text>
              <Text style={styles.requestPurpose}>{request.purpose}</Text>
            </View>
          </View>
          <View
            style={[
              styles.riskBadge,
              { backgroundColor: `${getRiskColor(riskAssessment.level)}15` },
            ]}
          >
            <Text
              style={[
                styles.riskBadgeText,
                { color: getRiskColor(riskAssessment.level) },
              ]}
            >
              {riskAssessment.level} Risk
            </Text>
          </View>
        </View>

        <View style={styles.requestScores}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>XnScore</Text>
            <Text style={styles.scoreValue}>{request.requesterXnScore}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Honor Score</Text>
            <Text style={styles.scoreValue}>{request.requesterHonorScore}</Text>
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Requested</Text>
            <Text style={[styles.scoreValue, { color: "#00C6AE" }]}>
              {request.requestedPoints} pts
            </Text>
          </View>
        </View>

        {request.message && (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>"{request.message}"</Text>
          </View>
        )}

        {request.circleName && (
          <View style={styles.circleInfo}>
            <Ionicons name="people" size={14} color="#6B7280" />
            <Text style={styles.circleText}>For: {request.circleName}</Text>
          </View>
        )}

        <View style={styles.riskFactors}>
          <Text style={styles.riskFactorsTitle}>Assessment:</Text>
          {riskAssessment.factors.map((factor, index) => (
            <View key={index} style={styles.riskFactorItem}>
              <Ionicons
                name={
                  riskAssessment.level === "Low"
                    ? "checkmark-circle"
                    : "alert-circle"
                }
                size={14}
                color={getRiskColor(riskAssessment.level)}
              />
              <Text style={styles.riskFactorText}>{factor}</Text>
            </View>
          ))}
        </View>

        <View style={styles.requestActions}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={() => handleDeclineVouch(request)}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => handleApproveVouch(request)}
          >
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            <Text style={styles.approveButtonText}>Approve Vouch</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderActiveVouchCard = (vouch: ActiveVouch) => {
    return (
      <View key={vouch.id} style={styles.activeVouchCard}>
        <View style={styles.activeVouchHeader}>
          <View style={styles.requesterInfo}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {vouch.memberName.charAt(0)}
              </Text>
            </View>
            <View>
              <Text style={styles.requesterName}>{vouch.memberName}</Text>
              <Text style={styles.requestPurpose}>{vouch.purpose}</Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: `${getPaymentStatusColor(vouch.memberPaymentStatus)}15`,
              },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                { color: getPaymentStatusColor(vouch.memberPaymentStatus) },
              ]}
            >
              {getPaymentStatusLabel(vouch.memberPaymentStatus)}
            </Text>
          </View>
        </View>

        <View style={styles.vouchDetails}>
          <View style={styles.vouchDetailItem}>
            <Text style={styles.vouchDetailLabel}>Vouch Points</Text>
            <Text style={styles.vouchDetailValue}>{vouch.vouchPoints} pts</Text>
          </View>
          <View style={styles.vouchDetailItem}>
            <Text style={styles.vouchDetailLabel}>Days Remaining</Text>
            <Text style={styles.vouchDetailValue}>{vouch.daysRemaining}</Text>
          </View>
          <View style={styles.vouchDetailItem}>
            <Text style={styles.vouchDetailLabel}>Risk to Honor</Text>
            <Text style={[styles.vouchDetailValue, { color: "#DC2626" }]}>
              -{vouch.riskToHonorScore} pts
            </Text>
          </View>
        </View>

        {vouch.circleName && (
          <View style={styles.circleInfo}>
            <Ionicons name="people" size={14} color="#6B7280" />
            <Text style={styles.circleText}>{vouch.circleName}</Text>
          </View>
        )}

        <View style={styles.expirationBar}>
          <View style={styles.expirationHeader}>
            <Text style={styles.expirationLabel}>Expires: {vouch.expirationDate.split("T")[0]}</Text>
          </View>
          <View style={styles.expirationProgress}>
            <View
              style={[
                styles.expirationFill,
                { width: `${(vouch.daysRemaining / 90) * 100}%` },
              ]}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderHistoryCard = (history: VouchHistory) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case "successful":
          return "#00C6AE";
        case "defaulted":
          return "#DC2626";
        case "expired":
          return "#6B7280";
        default:
          return "#6B7280";
      }
    };

    return (
      <View key={history.id} style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <View style={styles.historyInfo}>
            <Text style={styles.historyName}>{history.memberName}</Text>
            <Text style={styles.historyDates}>
              {history.startDate} - {history.endDate}
            </Text>
          </View>
          <View
            style={[
              styles.historyStatus,
              { backgroundColor: `${getStatusColor(history.status)}15` },
            ]}
          >
            <Text
              style={[
                styles.historyStatusText,
                { color: getStatusColor(history.status) },
              ]}
            >
              {history.status.charAt(0).toUpperCase() + history.status.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.historyDetails}>
          <View style={styles.historyDetailItem}>
            <Text style={styles.historyDetailLabel}>Vouch Points</Text>
            <Text style={styles.historyDetailValue}>{history.vouchPoints}</Text>
          </View>
          <View style={styles.historyDetailItem}>
            <Text style={styles.historyDetailLabel}>Honor Impact</Text>
            <Text
              style={[
                styles.historyDetailValue,
                { color: history.honorScoreImpact >= 0 ? "#00C6AE" : "#DC2626" },
              ]}
            >
              {history.honorScoreImpact >= 0 ? "+" : ""}
              {history.honorScoreImpact}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case "requests":
        if (vouchRequests.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Ionicons name="hand-right-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No Pending Requests</Text>
              <Text style={styles.emptyStateText}>
                When members request your vouch, they'll appear here
              </Text>
            </View>
          );
        }
        return vouchRequests.map(renderRequestCard);

      case "active":
        if (activeVouches.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Ionicons name="shield-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No Active Vouches</Text>
              <Text style={styles.emptyStateText}>
                Approved vouches will appear here
              </Text>
            </View>
          );
        }
        return activeVouches.map(renderActiveVouchCard);

      case "history":
        if (vouchHistory.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No Vouch History</Text>
              <Text style={styles.emptyStateText}>
                Completed vouches will appear here
              </Text>
            </View>
          );
        }
        return vouchHistory.map(renderHistoryCard);
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
        <Text style={styles.headerTitle}>Vouch System</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderVouchStats()}

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && styles.activeTab,
              ]}
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
              {tab.count !== undefined && tab.count > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    activeTab === tab.key && styles.activeTabBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      activeTab === tab.key && styles.activeTabBadgeText,
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>{renderContent()}</View>

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
  content: {
    flex: 1,
  },
  statsCard: {
    backgroundColor: "#FFFFFF",
    margin: 20,
    padding: 20,
    borderRadius: 16,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  elderBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  elderBadgeIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  elderBadgeText: {
    fontSize: 16,
    fontWeight: "600",
  },
  vouchStrength: {
    alignItems: "flex-end",
  },
  vouchStrengthLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  vouchStrengthValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00C6AE",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  vouchCapacity: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 16,
  },
  capacityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  capacityLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  capacityValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  capacityBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
  },
  capacityFill: {
    height: 8,
    backgroundColor: "#00C6AE",
    borderRadius: 4,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
  },
  activeTab: {
    backgroundColor: "#1a1a2e",
  },
  tabText: {
    fontSize: 14,
    color: "#6B7280",
  },
  activeTabText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: "#9CA3AF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeTabBadge: {
    backgroundColor: "#00C6AE",
  },
  tabBadgeText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  activeTabBadgeText: {
    color: "#FFFFFF",
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  requestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  requesterInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#00C6AE",
  },
  requesterName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  requestPurpose: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  requestScores: {
    flexDirection: "row",
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  scoreItem: {
    flex: 1,
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 11,
    color: "#6B7280",
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginTop: 2,
  },
  messageBox: {
    backgroundColor: "#F5F7FA",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  messageText: {
    fontSize: 13,
    color: "#4B5563",
    fontStyle: "italic",
  },
  circleInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  circleText: {
    fontSize: 13,
    color: "#6B7280",
    marginLeft: 6,
  },
  riskFactors: {
    marginBottom: 16,
  },
  riskFactorsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 6,
  },
  riskFactorItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  riskFactorText: {
    fontSize: 12,
    color: "#4B5563",
    marginLeft: 6,
  },
  requestActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    marginRight: 8,
  },
  declineButtonText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  approveButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#00C6AE",
    borderRadius: 8,
  },
  approveButtonText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 6,
  },
  activeVouchCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  activeVouchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  vouchDetails: {
    flexDirection: "row",
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  vouchDetailItem: {
    flex: 1,
    alignItems: "center",
  },
  vouchDetailLabel: {
    fontSize: 11,
    color: "#6B7280",
  },
  vouchDetailValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginTop: 2,
  },
  expirationBar: {
    marginTop: 4,
  },
  expirationHeader: {
    marginBottom: 6,
  },
  expirationLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  expirationProgress: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
  },
  expirationFill: {
    height: 6,
    backgroundColor: "#00C6AE",
    borderRadius: 3,
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  historyInfo: {},
  historyName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  historyDates: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  historyStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  historyDetails: {
    flexDirection: "row",
  },
  historyDetailItem: {
    marginRight: 24,
  },
  historyDetailLabel: {
    fontSize: 11,
    color: "#6B7280",
  },
  historyDetailValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a2e",
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  bottomPadding: {
    height: 40,
  },
});
