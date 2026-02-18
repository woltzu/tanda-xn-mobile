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

interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string;
  position: number;
  status: "active" | "pending" | "paused" | "removed";
  joinedDate: string;
  hasReceivedPayout: boolean;
  contributionStatus: "current" | "behind" | "ahead";
  avatar?: string;
}

interface ManageMembersParams {
  circleName?: string;
  circleId?: string;
}

// Mock members data
const mockMembers: Member[] = [
  {
    id: "1",
    name: "You (Admin)",
    email: "admin@example.com",
    phone: "+1 555-0101",
    position: 1,
    status: "active",
    joinedDate: "2025-01-01",
    hasReceivedPayout: true,
    contributionStatus: "current",
  },
  {
    id: "2",
    name: "Marie Kamga",
    email: "marie.k@example.com",
    phone: "+1 555-0102",
    position: 2,
    status: "active",
    joinedDate: "2025-01-02",
    hasReceivedPayout: true,
    contributionStatus: "current",
  },
  {
    id: "3",
    name: "Jean Pierre",
    email: "jean.p@example.com",
    phone: "+1 555-0103",
    position: 3,
    status: "active",
    joinedDate: "2025-01-03",
    hasReceivedPayout: true,
    contributionStatus: "behind",
  },
  {
    id: "4",
    name: "Paul Mbarga",
    email: "paul.m@example.com",
    position: 4,
    status: "paused",
    joinedDate: "2025-01-04",
    hasReceivedPayout: false,
    contributionStatus: "current",
  },
  {
    id: "5",
    name: "Sarah Lobe",
    email: "sarah.l@example.com",
    position: 5,
    status: "active",
    joinedDate: "2025-01-05",
    hasReceivedPayout: false,
    contributionStatus: "current",
  },
  {
    id: "6",
    name: "David Nkodo",
    email: "david.n@example.com",
    position: 6,
    status: "pending",
    joinedDate: "2025-01-10",
    hasReceivedPayout: false,
    contributionStatus: "current",
  },
];

export default function ManageMembersScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params as ManageMembersParams) || {};
  const circleName = params.circleName || "Family Savings Circle";

  const [members, setMembers] = useState<Member[]>(mockMembers);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | Member["status"]>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);

  // Add member form state
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");

  const filteredMembers = members
    .filter((m) => filterStatus === "all" || m.status === filterStatus)
    .filter(
      (m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.position - b.position);

  const getStatusColor = (status: Member["status"]) => {
    switch (status) {
      case "active":
        return "#10B981";
      case "pending":
        return "#F59E0B";
      case "paused":
        return "#6B7280";
      case "removed":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getContributionColor = (status: Member["contributionStatus"]) => {
    switch (status) {
      case "current":
        return "#10B981";
      case "behind":
        return "#EF4444";
      case "ahead":
        return "#2563EB";
      default:
        return "#6B7280";
    }
  };

  const handleAddMember = () => {
    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      Alert.alert("Error", "Please enter name and email");
      return;
    }

    const newMember: Member = {
      id: Date.now().toString(),
      name: newMemberName,
      email: newMemberEmail,
      phone: newMemberPhone || undefined,
      position: members.length + 1,
      status: "pending",
      joinedDate: new Date().toISOString().split("T")[0],
      hasReceivedPayout: false,
      contributionStatus: "current",
    };

    setMembers([...members, newMember]);
    setNewMemberName("");
    setNewMemberEmail("");
    setNewMemberPhone("");
    setShowAddModal(false);

    Alert.alert(
      "Invitation Sent",
      `An invitation has been sent to ${newMemberEmail}. They will appear as "Pending" until they accept.`
    );
  };

  const handleRemoveMember = (member: Member) => {
    if (member.id === "1") {
      Alert.alert("Cannot Remove", "You cannot remove yourself from the circle.");
      return;
    }

    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${member.name} from the circle?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setMembers(members.filter((m) => m.id !== member.id));
            setShowMemberModal(false);
            setSelectedMember(null);
          },
        },
      ]
    );
  };

  const handlePauseMember = (member: Member) => {
    Alert.alert(
      member.status === "paused" ? "Unpause Member" : "Pause Member",
      member.status === "paused"
        ? `Reactivate ${member.name}'s membership?`
        : `Pause ${member.name}'s participation? They will skip upcoming cycles.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: member.status === "paused" ? "Reactivate" : "Pause",
          onPress: () => {
            setMembers(
              members.map((m) =>
                m.id === member.id
                  ? { ...m, status: m.status === "paused" ? "active" : "paused" }
                  : m
              )
            );
            setShowMemberModal(false);
          },
        },
      ]
    );
  };

  const handleMoveUp = (member: Member) => {
    if (member.position === 1) return;
    const newMembers = members.map((m) => {
      if (m.position === member.position - 1) {
        return { ...m, position: member.position };
      }
      if (m.id === member.id) {
        return { ...m, position: member.position - 1 };
      }
      return m;
    });
    setMembers(newMembers);
  };

  const handleMoveDown = (member: Member) => {
    if (member.position === members.length) return;
    const newMembers = members.map((m) => {
      if (m.position === member.position + 1) {
        return { ...m, position: member.position };
      }
      if (m.id === member.id) {
        return { ...m, position: member.position + 1 };
      }
      return m;
    });
    setMembers(newMembers);
  };

  const renderMemberCard = (member: Member) => (
    <TouchableOpacity
      key={member.id}
      style={styles.memberCard}
      onPress={() => {
        if (!isReorderMode) {
          setSelectedMember(member);
          setShowMemberModal(true);
        }
      }}
      activeOpacity={isReorderMode ? 1 : 0.7}
    >
      <View style={styles.memberLeft}>
        <View style={styles.positionBadge}>
          <Text style={styles.positionText}>{member.position}</Text>
        </View>
        <View
          style={[
            styles.avatar,
            { backgroundColor: member.id === "1" ? "#2563EB" : "#E5E7EB" },
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              { color: member.id === "1" ? "#FFFFFF" : "#6B7280" },
            ]}
          >
            {member.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)}
          </Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{member.name}</Text>
          <Text style={styles.memberEmail}>{member.email}</Text>
          <View style={styles.memberTags}>
            <View
              style={[
                styles.statusTag,
                { backgroundColor: `${getStatusColor(member.status)}20` },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: getStatusColor(member.status) },
                ]}
              />
              <Text
                style={[styles.statusTagText, { color: getStatusColor(member.status) }]}
              >
                {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
              </Text>
            </View>
            {member.hasReceivedPayout && (
              <View style={styles.payoutTag}>
                <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                <Text style={styles.payoutTagText}>Paid</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {isReorderMode ? (
        <View style={styles.reorderButtons}>
          <TouchableOpacity
            style={[
              styles.reorderButton,
              member.position === 1 && styles.reorderButtonDisabled,
            ]}
            onPress={() => handleMoveUp(member)}
            disabled={member.position === 1}
          >
            <Ionicons
              name="chevron-up"
              size={20}
              color={member.position === 1 ? "#D1D5DB" : "#2563EB"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.reorderButton,
              member.position === members.length && styles.reorderButtonDisabled,
            ]}
            onPress={() => handleMoveDown(member)}
            disabled={member.position === members.length}
          >
            <Ionicons
              name="chevron-down"
              size={20}
              color={member.position === members.length ? "#D1D5DB" : "#2563EB"}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      )}
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
          <Text style={styles.headerTitle}>Manage Members</Text>
          <Text style={styles.headerSubtitle}>
            {members.length} members • {circleName}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.reorderToggle, isReorderMode && styles.reorderToggleActive]}
          onPress={() => setIsReorderMode(!isReorderMode)}
        >
          <Ionicons
            name="swap-vertical"
            size={24}
            color={isReorderMode ? "#FFFFFF" : "#2563EB"}
          />
        </TouchableOpacity>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "pending", label: "Pending" },
            { key: "paused", label: "Paused" },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.filterTab,
                filterStatus === item.key && styles.filterTabActive,
              ]}
              onPress={() => setFilterStatus(item.key as any)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterStatus === item.key && styles.filterTabTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isReorderMode && (
        <View style={styles.reorderNotice}>
          <Ionicons name="information-circle" size={18} color="#2563EB" />
          <Text style={styles.reorderNoticeText}>
            Tap arrows to change payout order. Changes affect future cycles only.
          </Text>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredMembers.length > 0 ? (
          filteredMembers.map(renderMemberCard)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>No members found</Text>
          </View>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Add Member FAB */}
      {!isReorderMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="person-add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Add Member Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Member</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter member's name"
              placeholderTextColor="#9CA3AF"
              value={newMemberName}
              onChangeText={setNewMemberName}
            />

            <Text style={styles.inputLabel}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter email address"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              value={newMemberEmail}
              onChangeText={setNewMemberEmail}
            />

            <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter phone number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={newMemberPhone}
              onChangeText={setNewMemberPhone}
            />

            <View style={styles.infoBox}>
              <Ionicons name="mail-outline" size={18} color="#2563EB" />
              <Text style={styles.infoBoxText}>
                An invitation email will be sent to this address. The member will
                appear as "Pending" until they accept.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddMember}
            >
              <Ionicons name="send" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Send Invitation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Member Details Modal */}
      <Modal
        visible={showMemberModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedMember && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Member Details</Text>
                  <TouchableOpacity onPress={() => setShowMemberModal(false)}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <View style={styles.memberDetailHeader}>
                  <View style={styles.memberDetailAvatar}>
                    <Text style={styles.memberDetailAvatarText}>
                      {selectedMember.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)}
                    </Text>
                  </View>
                  <Text style={styles.memberDetailName}>{selectedMember.name}</Text>
                  <View
                    style={[
                      styles.statusBadgeLarge,
                      { backgroundColor: `${getStatusColor(selectedMember.status)}20` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeLargeText,
                        { color: getStatusColor(selectedMember.status) },
                      ]}
                    >
                      {selectedMember.status.charAt(0).toUpperCase() +
                        selectedMember.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <Ionicons name="mail-outline" size={18} color="#6B7280" />
                    <Text style={styles.detailText}>{selectedMember.email}</Text>
                  </View>
                  {selectedMember.phone && (
                    <View style={styles.detailRow}>
                      <Ionicons name="call-outline" size={18} color="#6B7280" />
                      <Text style={styles.detailText}>{selectedMember.phone}</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                    <Text style={styles.detailText}>
                      Joined {new Date(selectedMember.joinedDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="podium-outline" size={18} color="#6B7280" />
                    <Text style={styles.detailText}>
                      Position #{selectedMember.position} in payout order
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons
                      name={
                        selectedMember.contributionStatus === "current"
                          ? "checkmark-circle"
                          : "alert-circle"
                      }
                      size={18}
                      color={getContributionColor(selectedMember.contributionStatus)}
                    />
                    <Text
                      style={[
                        styles.detailText,
                        {
                          color: getContributionColor(
                            selectedMember.contributionStatus
                          ),
                        },
                      ]}
                    >
                      Contributions:{" "}
                      {selectedMember.contributionStatus === "current"
                        ? "Up to date"
                        : selectedMember.contributionStatus === "behind"
                        ? "Behind on payments"
                        : "Paid ahead"}
                    </Text>
                  </View>
                </View>

                {selectedMember.id !== "1" && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonSecondary]}
                      onPress={() => handlePauseMember(selectedMember)}
                    >
                      <Ionicons
                        name={
                          selectedMember.status === "paused"
                            ? "play-circle-outline"
                            : "pause-circle-outline"
                        }
                        size={20}
                        color="#6B7280"
                      />
                      <Text style={styles.actionButtonSecondaryText}>
                        {selectedMember.status === "paused" ? "Reactivate" : "Pause"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonDanger]}
                      onPress={() => handleRemoveMember(selectedMember)}
                    >
                      <Ionicons name="person-remove-outline" size={20} color="#DC2626" />
                      <Text style={styles.actionButtonDangerText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
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
    marginLeft: 8,
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
  reorderToggle: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
  },
  reorderToggleActive: {
    backgroundColor: "#2563EB",
  },
  searchContainer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
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
  reorderNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  reorderNoticeText: {
    flex: 1,
    fontSize: 13,
    color: "#1E40AF",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  positionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  positionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  memberEmail: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  memberTags: {
    flexDirection: "row",
    marginTop: 6,
    gap: 8,
  },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: "500",
  },
  payoutTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  payoutTagText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#10B981",
  },
  reorderButtons: {
    flexDirection: "column",
    gap: 4,
  },
  reorderButton: {
    padding: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
  },
  reorderButtonDisabled: {
    backgroundColor: "#F3F4F6",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 12,
  },
  bottomPadding: {
    height: 100,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
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
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4B5563",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1F2937",
    marginBottom: 16,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: "#1E40AF",
    lineHeight: 18,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  memberDetailHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  memberDetailAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  memberDetailAvatarText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  memberDetailName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  statusBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeLargeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  detailSection: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  detailText: {
    fontSize: 14,
    color: "#4B5563",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonSecondary: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionButtonSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  actionButtonDanger: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  actionButtonDangerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#DC2626",
  },
});
