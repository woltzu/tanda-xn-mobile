import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, TextInput, Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useCircleProposals, useCreateProposal, useCastVote } from "../hooks/useCircleDemocracy";

type RouteParams = { CircleVoting: { circleId: string } };

const VOTE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  yes: { bg: "#10B98115", text: "#10B981", icon: "thumbs-up" },
  no: { bg: "#EF444415", text: "#EF4444", icon: "thumbs-down" },
  abstain: { bg: "#6B728015", text: "#6B7280", icon: "remove-circle-outline" },
};

const STATUS_STYLES: Record<string, { color: string; icon: string; label: string }> = {
  draft: { color: "#6B7280", icon: "create-outline", label: "Draft" },
  open: { color: "#3B82F6", icon: "radio-button-on", label: "Open" },
  closed: { color: "#F59E0B", icon: "lock-closed", label: "Closed" },
  executed: { color: "#10B981", icon: "checkmark-done-circle", label: "Executed" },
  cancelled: { color: "#EF4444", icon: "close-circle", label: "Cancelled" },
};

export default function CircleVotingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "CircleVoting">>();
  const { circleId } = route.params;

  const [activeTab, setActiveTab] = useState<"active" | "closed">("active");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [votingProposalId, setVotingProposalId] = useState<string | null>(null);
  const [voteReasoning, setVoteReasoning] = useState("");

  const {
    activeProposals,
    closedProposals,
    loading,
    error,
    refetch,
  } = useCircleProposals(circleId);

  const { createAndOpen, loading: creating } = useCreateProposal();
  const { castVote, loading: voting } = useCastVote();

  const handleCreateProposal = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Error", "Please enter a proposal title.");
      return;
    }
    const result = await createAndOpen(circleId, "general", newTitle.trim(), newDescription.trim());
    if (result) {
      setShowCreateModal(false);
      setNewTitle("");
      setNewDescription("");
      refetch();
    }
  };

  const handleVote = async (proposalId: string, vote: "yes" | "no" | "abstain") => {
    const result = await castVote(proposalId, vote, voteReasoning.trim() || undefined);
    if (result) {
      setVotingProposalId(null);
      setVoteReasoning("");
      refetch();
    }
  };

  const proposals = activeTab === "active" ? activeProposals : closedProposals;

  if (loading && activeProposals.length === 0 && closedProposals.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C6AE" />
        <Text style={styles.loadingText}>Loading proposals...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Circle Voting</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Ionicons name="radio-button-on" size={12} color="#3B82F6" />
            <Text style={styles.statText}>{activeProposals.length} Active</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="checkmark-done" size={12} color="#10B981" />
            <Text style={styles.statText}>{closedProposals.length} Completed</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "active" && styles.tabActive]}
          onPress={() => setActiveTab("active")}
        >
          <Text style={[styles.tabText, activeTab === "active" && styles.tabTextActive]}>
            Active ({activeProposals.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "closed" && styles.tabActive]}
          onPress={() => setActiveTab("closed")}
        >
          <Text style={[styles.tabText, activeTab === "closed" && styles.tabTextActive]}>
            Completed ({closedProposals.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {proposals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color="#00C6AE" />
            <Text style={styles.emptyTitle}>
              {activeTab === "active" ? "No Active Proposals" : "No Completed Proposals"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "active"
                ? "Tap + to create a new proposal for your circle"
                : "Completed proposals will appear here"}
            </Text>
          </View>
        ) : (
          proposals.map((proposal) => {
            const statusStyle = STATUS_STYLES[proposal.status] || STATUS_STYLES.draft;
            const isOpen = proposal.status === "open";
            const endsAt = proposal.votingEndsAt ? new Date(proposal.votingEndsAt) : null;
            const isExpired = endsAt ? endsAt <= new Date() : false;

            return (
              <View key={proposal.id} style={styles.card}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.color + "15" }]}>
                    <Ionicons name={statusStyle.icon as any} size={12} color={statusStyle.color} />
                    <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
                  </View>
                  {endsAt && (
                    <Text style={styles.deadline}>
                      {isExpired ? "Ended" : `Ends ${endsAt.toLocaleDateString()}`}
                    </Text>
                  )}
                </View>

                {/* Title & Description */}
                <Text style={styles.proposalTitle}>{proposal.title}</Text>
                {proposal.description && (
                  <Text style={styles.proposalDesc} numberOfLines={3}>{proposal.description}</Text>
                )}

                {/* Type Badge */}
                <View style={styles.typeBadge}>
                  <Ionicons name="document-text-outline" size={12} color="#8B5CF6" />
                  <Text style={styles.typeText}>
                    {proposal.proposalType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </Text>
                </View>

                {/* Vote Progress */}
                {proposal.yesVotes != null && (
                  <View style={styles.voteProgress}>
                    <View style={styles.voteRow}>
                      <View style={styles.voteItem}>
                        <Ionicons name="thumbs-up" size={14} color="#10B981" />
                        <Text style={[styles.voteCount, { color: "#10B981" }]}>{proposal.yesVotes ?? 0}</Text>
                      </View>
                      <View style={styles.voteItem}>
                        <Ionicons name="thumbs-down" size={14} color="#EF4444" />
                        <Text style={[styles.voteCount, { color: "#EF4444" }]}>{proposal.noVotes ?? 0}</Text>
                      </View>
                      <View style={styles.voteItem}>
                        <Ionicons name="remove-circle-outline" size={14} color="#6B7280" />
                        <Text style={[styles.voteCount, { color: "#6B7280" }]}>{proposal.abstainVotes ?? 0}</Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    {(proposal.yesVotes ?? 0) + (proposal.noVotes ?? 0) > 0 && (
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.round(
                                ((proposal.yesVotes ?? 0) /
                                  ((proposal.yesVotes ?? 0) + (proposal.noVotes ?? 0))) *
                                100
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                    )}
                  </View>
                )}

                {/* Vote Actions */}
                {isOpen && !isExpired && (
                  <>
                    {votingProposalId === proposal.id ? (
                      <View style={styles.voteActions}>
                        <TextInput
                          style={styles.reasonInput}
                          placeholder="Reason (optional)"
                          placeholderTextColor="#9CA3AF"
                          value={voteReasoning}
                          onChangeText={setVoteReasoning}
                        />
                        <View style={styles.voteButtons}>
                          {(["yes", "no", "abstain"] as const).map((choice) => {
                            const cfg = VOTE_COLORS[choice];
                            return (
                              <TouchableOpacity
                                key={choice}
                                style={[styles.voteBtn, { backgroundColor: cfg.bg }]}
                                onPress={() => handleVote(proposal.id, choice)}
                                disabled={voting}
                              >
                                <Ionicons name={cfg.icon as any} size={16} color={cfg.text} />
                                <Text style={[styles.voteBtnText, { color: cfg.text }]}>
                                  {choice.charAt(0).toUpperCase() + choice.slice(1)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <TouchableOpacity onPress={() => { setVotingProposalId(null); setVoteReasoning(""); }}>
                          <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.castVoteBtn}
                        onPress={() => setVotingProposalId(proposal.id)}
                      >
                        <Ionicons name="hand-left-outline" size={16} color="#00C6AE" />
                        <Text style={styles.castVoteText}>Cast Your Vote</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Create Proposal Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Proposal</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#0A2342" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="What are you proposing?"
              placeholderTextColor="#9CA3AF"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Provide details about your proposal..."
              placeholderTextColor="#9CA3AF"
              value={newDescription}
              onChangeText={setNewDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, creating && styles.submitBtnDisabled]}
              onPress={handleCreateProposal}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Submit Proposal</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F7FA" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6B7280" },

  // Header
  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },

  statsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  statPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  statText: { fontSize: 12, color: "#FFFFFF", fontWeight: "500" },

  // Tabs
  tabRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: "#FFFFFF" },
  tabActive: { backgroundColor: "#00C6AE15", borderWidth: 1, borderColor: "#00C6AE" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  tabTextActive: { color: "#00C6AE" },

  // Content
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  // Error
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 10, marginBottom: 12 },
  errorText: { fontSize: 13, color: "#EF4444", flex: 1 },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#0A2342", marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4, textAlign: "center", paddingHorizontal: 24 },

  // Card
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "600" },
  deadline: { fontSize: 11, color: "#6B7280" },

  proposalTitle: { fontSize: 16, fontWeight: "700", color: "#0A2342", marginBottom: 4 },
  proposalDesc: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginBottom: 8 },

  typeBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "#8B5CF615", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginBottom: 12 },
  typeText: { fontSize: 11, color: "#8B5CF6", fontWeight: "500" },

  // Vote Progress
  voteProgress: { borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 12, marginBottom: 8 },
  voteRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 8 },
  voteItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  voteCount: { fontSize: 14, fontWeight: "700" },
  progressBarBg: { height: 6, backgroundColor: "#F3F4F6", borderRadius: 3, overflow: "hidden" },
  progressBarFill: { height: 6, backgroundColor: "#10B981", borderRadius: 3 },

  // Vote Actions
  castVoteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#00C6AE", marginTop: 4 },
  castVoteText: { fontSize: 14, fontWeight: "600", color: "#00C6AE" },

  voteActions: { borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 12, gap: 10 },
  reasonInput: { backgroundColor: "#F5F7FA", borderRadius: 8, padding: 10, fontSize: 13, color: "#0A2342" },
  voteButtons: { flexDirection: "row", gap: 8 },
  voteBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderRadius: 8 },
  voteBtnText: { fontSize: 13, fontWeight: "600" },
  cancelText: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0A2342" },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#0A2342", marginBottom: 6 },
  modalInput: { backgroundColor: "#F5F7FA", borderRadius: 10, padding: 12, fontSize: 14, color: "#0A2342", marginBottom: 16 },
  modalTextArea: { height: 100 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#00C6AE", paddingVertical: 14, borderRadius: 12 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
