import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useElder, MediationCase, CaseType, CaseSeverity } from "../context/ElderContext";

type RootStackParamList = {
  MediationCase: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = "available" | "my_cases";
type FilterType = "all" | CaseType;

export default function MediationCaseScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    elderProfile,
    availableCases,
    myCases,
    acceptCase,
    submitRuling,
    escalateCase,
    isLoading,
  } = useElder();

  const [activeTab, setActiveTab] = useState<TabType>("available");
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [selectedCase, setSelectedCase] = useState<MediationCase | null>(null);
  const [showRulingModal, setShowRulingModal] = useState(false);
  const [rulingText, setRulingText] = useState("");
  const [explanationText, setExplanationText] = useState("");

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "available", label: "Available", count: availableCases.length },
    { key: "my_cases", label: "My Cases", count: myCases.length },
  ];

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "payment", label: "Payment" },
    { key: "trust", label: "Trust" },
    { key: "financial", label: "Financial" },
    { key: "communication", label: "Communication" },
  ];

  const getSeverityColor = (severity: CaseSeverity) => {
    switch (severity) {
      case "high":
        return "#DC2626";
      case "medium":
        return "#D97706";
      case "low":
        return "#00C6AE";
      default:
        return "#6B7280";
    }
  };

  const getCaseTypeIcon = (type: CaseType) => {
    switch (type) {
      case "payment":
        return "card";
      case "trust":
        return "shield";
      case "financial":
        return "cash";
      case "communication":
        return "chatbubbles";
      default:
        return "help-circle";
    }
  };

  const getCaseTypeColor = (type: CaseType) => {
    switch (type) {
      case "payment":
        return "#3B82F6";
      case "trust":
        return "#7C3AED";
      case "financial":
        return "#00C6AE";
      case "communication":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "#6B7280";
      case "assigned":
        return "#3B82F6";
      case "in_progress":
        return "#D97706";
      case "resolved":
        return "#00C6AE";
      case "escalated":
        return "#DC2626";
      default:
        return "#6B7280";
    }
  };

  const handleAcceptCase = (caseItem: MediationCase) => {
    if (elderProfile && elderProfile.activeCases >= elderProfile.maxConcurrentCases) {
      Alert.alert(
        "Case Limit Reached",
        `You already have ${elderProfile.maxConcurrentCases} active cases. Complete or escalate existing cases before accepting new ones.`
      );
      return;
    }

    Alert.alert(
      "Accept Case",
      `Do you want to accept this ${caseItem.severity} severity case?\n\n"${caseItem.title}"\n\nReward: ${caseItem.reward.honorScore} Honor pts + $${caseItem.reward.fee}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: () => acceptCase(caseItem.id),
        },
      ]
    );
  };

  const handleOpenRuling = (caseItem: MediationCase) => {
    setSelectedCase(caseItem);
    setShowRulingModal(true);
  };

  const handleSubmitRuling = async () => {
    if (!selectedCase || !rulingText.trim() || !explanationText.trim()) {
      Alert.alert("Error", "Please provide both a ruling and an explanation.");
      return;
    }

    await submitRuling(selectedCase.id, rulingText, explanationText);
    setShowRulingModal(false);
    setSelectedCase(null);
    setRulingText("");
    setExplanationText("");

    Alert.alert("Success", "Your ruling has been submitted successfully!");
  };

  const handleEscalateCase = (caseItem: MediationCase) => {
    Alert.prompt(
      "Escalate Case",
      "Please provide a reason for escalation:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Escalate",
          style: "destructive",
          onPress: (reason) => {
            if (reason) {
              escalateCase(caseItem.id, reason);
            }
          },
        },
      ],
      "plain-text"
    );
  };

  const filteredCases = (cases: MediationCase[]) => {
    if (selectedFilter === "all") return cases;
    return cases.filter((c) => c.type === selectedFilter);
  };

  const renderCaseCard = (caseItem: MediationCase, isAvailable: boolean) => {
    return (
      <View key={caseItem.id} style={styles.caseCard}>
        {/* Header */}
        <View style={styles.caseHeader}>
          <View style={styles.caseTypeContainer}>
            <View
              style={[
                styles.caseTypeIcon,
                { backgroundColor: `${getCaseTypeColor(caseItem.type)}15` },
              ]}
            >
              <Ionicons
                name={getCaseTypeIcon(caseItem.type) as any}
                size={18}
                color={getCaseTypeColor(caseItem.type)}
              />
            </View>
            <View>
              <Text style={styles.caseType}>
                {caseItem.type.charAt(0).toUpperCase() + caseItem.type.slice(1)} Dispute
              </Text>
              <Text style={styles.caseDays}>
                Opened {caseItem.openedDays} days ago
              </Text>
            </View>
          </View>
          <View style={styles.caseBadges}>
            <View
              style={[
                styles.severityBadge,
                { backgroundColor: `${getSeverityColor(caseItem.severity)}15` },
              ]}
            >
              <Text
                style={[
                  styles.severityText,
                  { color: getSeverityColor(caseItem.severity) },
                ]}
              >
                {caseItem.severity.charAt(0).toUpperCase() + caseItem.severity.slice(1)}
              </Text>
            </View>
            {caseItem.matchesSpecialization && (
              <View style={styles.matchBadge}>
                <Ionicons name="star" size={12} color="#D97706" />
              </View>
            )}
          </View>
        </View>

        {/* Title & Description */}
        <Text style={styles.caseTitle}>{caseItem.title}</Text>
        <Text style={styles.caseDescription} numberOfLines={2}>
          {caseItem.description}
        </Text>

        {/* Circle Info */}
        <View style={styles.circleInfo}>
          <Ionicons name="people" size={14} color="#6B7280" />
          <Text style={styles.circleText}>{caseItem.circleName}</Text>
          <Text style={styles.partiesText}>
            • {caseItem.partiesInvolved} parties
          </Text>
        </View>

        {/* Parties (for my cases) */}
        {!isAvailable && caseItem.parties && (
          <View style={styles.partiesContainer}>
            {caseItem.parties.slice(0, 2).map((party, index) => (
              <View key={party.id} style={styles.partyItem}>
                <View style={styles.partyAvatar}>
                  <Text style={styles.partyAvatarText}>
                    {party.name.charAt(0)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.partyName}>{party.name}</Text>
                  <Text style={styles.partyRole}>{party.role}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Stats Row */}
        <View style={styles.caseStats}>
          <View style={styles.caseStat}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={styles.caseStatText}>Est. {caseItem.estimatedTime}</Text>
          </View>
          <View style={styles.caseStat}>
            <Ionicons name="star-outline" size={14} color="#00C6AE" />
            <Text style={[styles.caseStatText, { color: "#00C6AE" }]}>
              +{caseItem.reward.honorScore} pts
            </Text>
          </View>
          <View style={styles.caseStat}>
            <Ionicons name="cash-outline" size={14} color="#00C6AE" />
            <Text style={[styles.caseStatText, { color: "#00C6AE" }]}>
              ${caseItem.reward.fee}
            </Text>
          </View>
        </View>

        {/* Status for my cases */}
        {!isAvailable && (
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${getStatusColor(caseItem.status)}15` },
              ]}
            >
              <Text
                style={[styles.statusText, { color: getStatusColor(caseItem.status) }]}
              >
                {caseItem.status.replace("_", " ").toUpperCase()}
              </Text>
            </View>
            {caseItem.dueDate && (
              <Text style={styles.dueDate}>Due: {caseItem.dueDate}</Text>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.caseActions}>
          {isAvailable ? (
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAcceptCase(caseItem)}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.acceptButtonText}>Accept Case</Text>
            </TouchableOpacity>
          ) : (
            <>
              {caseItem.status !== "resolved" && caseItem.status !== "escalated" && (
                <>
                  <TouchableOpacity
                    style={styles.escalateButton}
                    onPress={() => handleEscalateCase(caseItem)}
                  >
                    <Text style={styles.escalateButtonText}>Escalate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rulingButton}
                    onPress={() => handleOpenRuling(caseItem)}
                  >
                    <Ionicons name="document-text" size={18} color="#FFFFFF" />
                    <Text style={styles.rulingButtonText}>Submit Ruling</Text>
                  </TouchableOpacity>
                </>
              )}
              {caseItem.status === "resolved" && caseItem.resolution && (
                <View style={styles.resolutionBox}>
                  <Text style={styles.resolutionLabel}>Ruling:</Text>
                  <Text style={styles.resolutionText}>
                    {caseItem.resolution.ruling}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  const renderCaseStats = () => {
    if (!elderProfile) return null;

    return (
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{elderProfile.activeCases}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {elderProfile.maxConcurrentCases - elderProfile.activeCases}
            </Text>
            <Text style={styles.statLabel}>Available Slots</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{elderProfile.totalCasesResolved}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#00C6AE" }]}>
              {elderProfile.successRate}%
            </Text>
            <Text style={styles.statLabel}>Success Rate</Text>
          </View>
        </View>
      </View>
    );
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
        <Text style={styles.headerTitle}>Mediation Cases</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderCaseStats()}

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
            </TouchableOpacity>
          ))}
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterChip,
                selectedFilter === filter.key && styles.activeFilterChip,
              ]}
              onPress={() => setSelectedFilter(filter.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilter === filter.key && styles.activeFilterChipText,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Legend */}
        {activeTab === "available" && (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <Ionicons name="star" size={14} color="#D97706" />
              <Text style={styles.legendText}>Matches your specialization</Text>
            </View>
          </View>
        )}

        {/* Cases */}
        <View style={styles.casesContainer}>
          {activeTab === "available" ? (
            filteredCases(availableCases).length > 0 ? (
              filteredCases(availableCases).map((c) => renderCaseCard(c, true))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="folder-open-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>No Available Cases</Text>
                <Text style={styles.emptyStateText}>
                  Check back later for new cases
                </Text>
              </View>
            )
          ) : filteredCases(myCases).length > 0 ? (
            filteredCases(myCases).map((c) => renderCaseCard(c, false))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No Active Cases</Text>
              <Text style={styles.emptyStateText}>
                Accept cases from the Available tab
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Ruling Modal */}
      <Modal
        visible={showRulingModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowRulingModal(false);
                setSelectedCase(null);
                setRulingText("");
                setExplanationText("");
              }}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Submit Ruling</Text>
            <TouchableOpacity
              onPress={handleSubmitRuling}
              disabled={!rulingText.trim() || !explanationText.trim()}
            >
              <Text
                style={[
                  styles.modalSubmit,
                  (!rulingText.trim() || !explanationText.trim()) &&
                    styles.modalSubmitDisabled,
                ]}
              >
                Submit
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedCase && (
              <>
                <View style={styles.modalCaseInfo}>
                  <Text style={styles.modalCaseTitle}>{selectedCase.title}</Text>
                  <Text style={styles.modalCircle}>{selectedCase.circleName}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Ruling Decision *</Text>
                  <TextInput
                    style={styles.rulingInput}
                    placeholder="e.g., In favor of the complainant, Split decision..."
                    value={rulingText}
                    onChangeText={setRulingText}
                    multiline
                  />
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Explanation *</Text>
                  <TextInput
                    style={[styles.rulingInput, styles.explanationInput]}
                    placeholder="Provide a detailed explanation of your ruling and reasoning..."
                    value={explanationText}
                    onChangeText={setExplanationText}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.rulingTemplates}>
                  <Text style={styles.templatesTitle}>Quick Templates</Text>
                  {[
                    "In favor of complainant - clear evidence supports their claim",
                    "In favor of respondent - insufficient evidence",
                    "Mutual resolution - both parties agreed to terms",
                    "Split ruling - partial merit on both sides",
                  ].map((template, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.templateButton}
                      onPress={() => setRulingText(template)}
                    >
                      <Text style={styles.templateText}>{template}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.rewardPreview}>
                  <Text style={styles.rewardPreviewTitle}>
                    Upon successful submission:
                  </Text>
                  <View style={styles.rewardPreviewRow}>
                    <Ionicons name="star" size={16} color="#00C6AE" />
                    <Text style={styles.rewardPreviewText}>
                      +{selectedCase.reward.honorScore} Honor Score
                    </Text>
                  </View>
                  <View style={styles.rewardPreviewRow}>
                    <Ionicons name="cash" size={16} color="#00C6AE" />
                    <Text style={styles.rewardPreviewText}>
                      ${selectedCase.reward.fee} Case Fee
                    </Text>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E5E7EB",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 12,
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
  filtersContainer: {
    marginBottom: 12,
  },
  filtersContent: {
    paddingHorizontal: 20,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  activeFilterChip: {
    backgroundColor: "#F0FDFB",
    borderColor: "#00C6AE",
  },
  filterChipText: {
    fontSize: 13,
    color: "#6B7280",
  },
  activeFilterChipText: {
    color: "#00C6AE",
    fontWeight: "600",
  },
  legend: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 6,
  },
  casesContainer: {
    paddingHorizontal: 20,
  },
  caseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  caseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  caseTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  caseTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  caseType: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  caseDays: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  caseBadges: {
    flexDirection: "row",
    alignItems: "center",
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  severityText: {
    fontSize: 11,
    fontWeight: "600",
  },
  matchBadge: {
    marginLeft: 6,
    padding: 4,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
  },
  caseTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 6,
  },
  caseDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 12,
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
  partiesText: {
    fontSize: 13,
    color: "#9CA3AF",
    marginLeft: 4,
  },
  partiesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  partyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  partyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  partyAvatarText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  partyName: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1a1a2e",
  },
  partyRole: {
    fontSize: 11,
    color: "#6B7280",
  },
  caseStats: {
    flexDirection: "row",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginBottom: 12,
  },
  caseStat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  caseStatText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  dueDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  caseActions: {
    flexDirection: "row",
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    borderRadius: 8,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 6,
  },
  escalateButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#DC2626",
    borderRadius: 8,
    marginRight: 8,
  },
  escalateButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#DC2626",
  },
  rulingButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    borderRadius: 8,
  },
  rulingButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 6,
  },
  resolutionBox: {
    flex: 1,
    backgroundColor: "#F0FDFB",
    padding: 12,
    borderRadius: 8,
  },
  resolutionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#00C6AE",
    marginBottom: 4,
  },
  resolutionText: {
    fontSize: 13,
    color: "#1a1a2e",
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
  },
  bottomPadding: {
    height: 40,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalCancel: {
    fontSize: 16,
    color: "#6B7280",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  modalSubmit: {
    fontSize: 16,
    fontWeight: "600",
    color: "#00C6AE",
  },
  modalSubmitDisabled: {
    color: "#9CA3AF",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalCaseInfo: {
    backgroundColor: "#F5F7FA",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  modalCaseTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  modalCircle: {
    fontSize: 14,
    color: "#6B7280",
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  rulingInput: {
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#1a1a2e",
    minHeight: 48,
  },
  explanationInput: {
    minHeight: 120,
  },
  rulingTemplates: {
    marginBottom: 24,
  },
  templatesTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  templateButton: {
    backgroundColor: "#F5F7FA",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  templateText: {
    fontSize: 13,
    color: "#4B5563",
  },
  rewardPreview: {
    backgroundColor: "#F0FDFB",
    padding: 16,
    borderRadius: 12,
  },
  rewardPreviewTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
    marginBottom: 8,
  },
  rewardPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  rewardPreviewText: {
    fontSize: 14,
    color: "#1a1a2e",
    marginLeft: 8,
  },
});
