import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

interface MediationToolsParams {
  circleName?: string;
  circleId?: string;
}

interface Dispute {
  id: string;
  reportId: string;
  reporter: string;
  reporterEmail: string;
  against?: string;
  category: string;
  title: string;
  description: string;
  status: "open" | "investigating" | "resolved" | "escalated";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
  notes: string[];
}

export default function MediationToolsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params as MediationToolsParams) || {};
  const circleName = params.circleName || "Family Savings Circle";

  const [disputes, setDisputes] = useState<Dispute[]>([
    {
      id: "1",
      reportId: "RPT-1705234567-ABC1",
      reporter: "Jean Pierre",
      reporterEmail: "jean.p@example.com",
      against: "Marie Kamga",
      category: "payment",
      title: "Late payment not marked correctly",
      description:
        "Marie's payment was marked as on-time but it was actually 2 days late. This affects the penalty calculation.",
      status: "open",
      priority: "medium",
      createdAt: "2025-01-15T10:30:00Z",
      updatedAt: "2025-01-15T10:30:00Z",
      notes: [],
    },
    {
      id: "2",
      reportId: "RPT-1705234568-DEF2",
      reporter: "Sarah Lobe",
      reporterEmail: "sarah.l@example.com",
      category: "technical",
      title: "Payment confirmation not received",
      description:
        "I made my payment but never received the confirmation email. The system shows as pending.",
      status: "investigating",
      priority: "high",
      createdAt: "2025-01-14T08:15:00Z",
      updatedAt: "2025-01-15T14:20:00Z",
      notes: ["Checking payment gateway logs", "Contacted support team"],
    },
    {
      id: "3",
      reportId: "RPT-1705234569-GHI3",
      reporter: "Paul Mbarga",
      reporterEmail: "paul.m@example.com",
      against: "Admin",
      category: "member",
      title: "Unfair pause of membership",
      description:
        "My membership was paused without proper notice. I believe this was done unfairly.",
      status: "resolved",
      priority: "medium",
      createdAt: "2025-01-10T16:45:00Z",
      updatedAt: "2025-01-13T11:30:00Z",
      notes: [
        "Reviewed pause reason",
        "Member had 2 missed payments",
        "Pause was according to rules",
        "Explained rules to member - accepted resolution",
      ],
    },
  ]);

  const [filterStatus, setFilterStatus] = useState<"all" | Dispute["status"]>("all");
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [resolution, setResolution] = useState("");

  const filteredDisputes =
    filterStatus === "all"
      ? disputes
      : disputes.filter((d) => d.status === filterStatus);

  const getStatusColor = (status: Dispute["status"]) => {
    switch (status) {
      case "open":
        return "#EF4444";
      case "investigating":
        return "#F59E0B";
      case "resolved":
        return "#10B981";
      case "escalated":
        return "#7C3AED";
      default:
        return "#6B7280";
    }
  };

  const getPriorityColor = (priority: Dispute["priority"]) => {
    switch (priority) {
      case "urgent":
        return "#DC2626";
      case "high":
        return "#EF4444";
      case "medium":
        return "#F59E0B";
      case "low":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "payment":
        return "card-outline";
      case "member":
        return "person-outline";
      case "technical":
        return "settings-outline";
      case "fraud":
        return "shield-outline";
      default:
        return "help-circle-outline";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !selectedDispute) return;

    const updatedDisputes = disputes.map((d) =>
      d.id === selectedDispute.id
        ? {
            ...d,
            notes: [...d.notes, newNote],
            updatedAt: new Date().toISOString(),
          }
        : d
    );
    setDisputes(updatedDisputes);
    setSelectedDispute({
      ...selectedDispute,
      notes: [...selectedDispute.notes, newNote],
    });
    setNewNote("");
    Alert.alert("Note Added", "Your note has been added to the dispute.");
  };

  const handleUpdateStatus = (newStatus: Dispute["status"]) => {
    if (!selectedDispute) return;

    const updatedDisputes = disputes.map((d) =>
      d.id === selectedDispute.id
        ? { ...d, status: newStatus, updatedAt: new Date().toISOString() }
        : d
    );
    setDisputes(updatedDisputes);
    setSelectedDispute({ ...selectedDispute, status: newStatus });
    setShowActionModal(false);
    Alert.alert("Status Updated", `Dispute status changed to ${newStatus}.`);
  };

  const handleResolve = () => {
    if (!resolution.trim() || !selectedDispute) {
      Alert.alert("Resolution Required", "Please provide a resolution summary.");
      return;
    }

    const updatedDisputes = disputes.map((d) =>
      d.id === selectedDispute.id
        ? {
            ...d,
            status: "resolved" as const,
            notes: [...d.notes, `Resolution: ${resolution}`],
            updatedAt: new Date().toISOString(),
          }
        : d
    );
    setDisputes(updatedDisputes);
    setSelectedDispute({
      ...selectedDispute,
      status: "resolved",
      notes: [...selectedDispute.notes, `Resolution: ${resolution}`],
    });
    setResolution("");
    setShowActionModal(false);
    Alert.alert("Dispute Resolved", "The dispute has been marked as resolved.");
  };

  const renderDisputeCard = (dispute: Dispute) => (
    <TouchableOpacity
      key={dispute.id}
      style={styles.disputeCard}
      onPress={() => {
        setSelectedDispute(dispute);
        setShowDetailModal(true);
      }}
    >
      <View style={styles.disputeHeader}>
        <View
          style={[
            styles.categoryIcon,
            { backgroundColor: `${getStatusColor(dispute.status)}20` },
          ]}
        >
          <Ionicons
            name={getCategoryIcon(dispute.category) as any}
            size={20}
            color={getStatusColor(dispute.status)}
          />
        </View>
        <View style={styles.disputeInfo}>
          <Text style={styles.disputeTitle} numberOfLines={1}>
            {dispute.title}
          </Text>
          <Text style={styles.disputeReportId}>{dispute.reportId}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${getStatusColor(dispute.status)}20` },
          ]}
        >
          <Text
            style={[styles.statusBadgeText, { color: getStatusColor(dispute.status) }]}
          >
            {dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}
          </Text>
        </View>
      </View>

      <Text style={styles.disputeDescription} numberOfLines={2}>
        {dispute.description}
      </Text>

      <View style={styles.disputeFooter}>
        <View style={styles.disputeMeta}>
          <Text style={styles.disputeMetaText}>From: {dispute.reporter}</Text>
          {dispute.against && (
            <Text style={styles.disputeMetaText}>Against: {dispute.against}</Text>
          )}
        </View>
        <View style={styles.disputeTags}>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: `${getPriorityColor(dispute.priority)}20` },
            ]}
          >
            <Text
              style={[
                styles.priorityBadgeText,
                { color: getPriorityColor(dispute.priority) },
              ]}
            >
              {dispute.priority.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

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
          <Text style={styles.headerTitle}>Mediation Tools</Text>
          <Text style={styles.headerSubtitle}>{circleName}</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {disputes.filter((d) => d.status === "open").length}
          </Text>
          <Text style={styles.statLabel}>Open</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {disputes.filter((d) => d.status === "investigating").length}
          </Text>
          <Text style={styles.statLabel}>Investigating</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {disputes.filter((d) => d.status === "resolved").length}
          </Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { key: "all", label: "All" },
            { key: "open", label: "Open" },
            { key: "investigating", label: "Investigating" },
            { key: "resolved", label: "Resolved" },
            { key: "escalated", label: "Escalated" },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterTab,
                filterStatus === filter.key && styles.filterTabActive,
              ]}
              onPress={() => setFilterStatus(filter.key as any)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterStatus === filter.key && styles.filterTabTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredDisputes.length > 0 ? (
          filteredDisputes.map(renderDisputeCard)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>No Disputes</Text>
            <Text style={styles.emptyStateText}>
              No {filterStatus === "all" ? "" : filterStatus} disputes found.
            </Text>
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Dispute Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedDispute && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Dispute Details</Text>
                  <TouchableOpacity
                    onPress={() => setShowDetailModal(false)}
                  >
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Status Badge */}
                <View style={styles.detailStatusRow}>
                  <View
                    style={[
                      styles.statusBadgeLarge,
                      { backgroundColor: `${getStatusColor(selectedDispute.status)}20` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeLargeText,
                        { color: getStatusColor(selectedDispute.status) },
                      ]}
                    >
                      {selectedDispute.status.charAt(0).toUpperCase() +
                        selectedDispute.status.slice(1)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.priorityBadgeLarge,
                      { backgroundColor: `${getPriorityColor(selectedDispute.priority)}20` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityBadgeLargeText,
                        { color: getPriorityColor(selectedDispute.priority) },
                      ]}
                    >
                      {selectedDispute.priority.toUpperCase()} Priority
                    </Text>
                  </View>
                </View>

                {/* Report Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Report ID</Text>
                  <Text style={styles.detailValue}>{selectedDispute.reportId}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Category</Text>
                  <Text style={styles.detailValue}>
                    {selectedDispute.category.charAt(0).toUpperCase() +
                      selectedDispute.category.slice(1)}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Title</Text>
                  <Text style={styles.detailValueBold}>{selectedDispute.title}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailDescription}>
                    {selectedDispute.description}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailHalf}>
                    <Text style={styles.detailLabel}>Reported By</Text>
                    <Text style={styles.detailValue}>{selectedDispute.reporter}</Text>
                  </View>
                  {selectedDispute.against && (
                    <View style={styles.detailHalf}>
                      <Text style={styles.detailLabel}>Against</Text>
                      <Text style={styles.detailValue}>{selectedDispute.against}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailHalf}>
                    <Text style={styles.detailLabel}>Created</Text>
                    <Text style={styles.detailValueSmall}>
                      {formatDate(selectedDispute.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.detailHalf}>
                    <Text style={styles.detailLabel}>Last Updated</Text>
                    <Text style={styles.detailValueSmall}>
                      {formatDate(selectedDispute.updatedAt)}
                    </Text>
                  </View>
                </View>

                {/* Notes Section */}
                <View style={styles.notesSection}>
                  <Text style={styles.notesTitle}>Case Notes</Text>
                  {selectedDispute.notes.length > 0 ? (
                    selectedDispute.notes.map((note, index) => (
                      <View key={index} style={styles.noteItem}>
                        <View style={styles.noteBullet} />
                        <Text style={styles.noteText}>{note}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noNotesText}>No notes yet</Text>
                  )}

                  <View style={styles.addNoteContainer}>
                    <TextInput
                      style={styles.noteInput}
                      placeholder="Add a note..."
                      placeholderTextColor="#9CA3AF"
                      value={newNote}
                      onChangeText={setNewNote}
                      multiline
                    />
                    <TouchableOpacity
                      style={[
                        styles.addNoteButton,
                        !newNote.trim() && styles.addNoteButtonDisabled,
                      ]}
                      onPress={handleAddNote}
                      disabled={!newNote.trim()}
                    >
                      <Ionicons name="add" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Action Buttons */}
                {selectedDispute.status !== "resolved" && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setShowActionModal(true)}
                  >
                    <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Take Action</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.contactButton}
                  onPress={() => {
                    Alert.alert(
                      "Contact Reporter",
                      `Send email to ${selectedDispute.reporterEmail}?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Send Email", onPress: () => {} },
                      ]
                    );
                  }}
                >
                  <Ionicons name="mail-outline" size={20} color="#2563EB" />
                  <Text style={styles.contactButtonText}>Contact Reporter</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.actionModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Take Action</Text>
              <TouchableOpacity onPress={() => setShowActionModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.actionSectionTitle}>Change Status</Text>
            <View style={styles.statusOptions}>
              {["open", "investigating", "escalated"].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusOption,
                    selectedDispute?.status === status && styles.statusOptionActive,
                  ]}
                  onPress={() => handleUpdateStatus(status as Dispute["status"])}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      selectedDispute?.status === status &&
                        styles.statusOptionTextActive,
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.actionSectionTitle}>Resolve Dispute</Text>
            <TextInput
              style={styles.resolutionInput}
              placeholder="Enter resolution summary..."
              placeholderTextColor="#9CA3AF"
              value={resolution}
              onChangeText={setResolution}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.resolveButton,
                !resolution.trim() && styles.resolveButtonDisabled,
              ]}
              onPress={handleResolve}
              disabled={!resolution.trim()}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.resolveButtonText}>Mark as Resolved</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerPlaceholder: {
    width: 40,
  },
  statsBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 12,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: "#2563EB",
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  disputeCard: {
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
  disputeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  disputeInfo: {
    flex: 1,
  },
  disputeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  disputeReportId: {
    fontSize: 12,
    color: "#9CA3AF",
    fontFamily: "monospace",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  disputeDescription: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 12,
  },
  disputeFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  disputeMeta: {
    flex: 1,
  },
  disputeMetaText: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  disputeTags: {
    flexDirection: "row",
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    padding: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  detailStatusRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statusBadgeLarge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeLargeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  priorityBadgeLarge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  priorityBadgeLargeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: "#1F2937",
  },
  detailValueBold: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  detailValueSmall: {
    fontSize: 13,
    color: "#4B5563",
  },
  detailDescription: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  detailHalf: {
    flex: 1,
  },
  notesSection: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  noteItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  noteBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2563EB",
    marginTop: 6,
    marginRight: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  noNotesText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  addNoteContainer: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  noteInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  addNoteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  addNoteButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563EB",
  },
  actionModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  actionSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
    marginTop: 8,
  },
  statusOptions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  statusOptionActive: {
    backgroundColor: "#2563EB",
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  statusOptionTextActive: {
    color: "#FFFFFF",
  },
  resolutionInput: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: "#1F2937",
    minHeight: 100,
    marginBottom: 16,
  },
  resolveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  resolveButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  resolveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
