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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

interface PauseCircleParams {
  circleName?: string;
  circleId?: string;
  currentCycle?: number;
  totalCycles?: number;
  memberCount?: number;
}

type PauseDuration = "1_cycle" | "2_cycles" | "1_month" | "2_months" | "custom";
type PauseReason = "holiday" | "emergency" | "financial" | "reorganization" | "other";

export default function PauseCircleScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params as PauseCircleParams) || {};

  const circleName = params.circleName || "Family Savings Circle";
  const currentCycle = params.currentCycle || 3;
  const totalCycles = params.totalCycles || 12;
  const memberCount = params.memberCount || 6;

  const [selectedDuration, setSelectedDuration] = useState<PauseDuration | null>(null);
  const [customWeeks, setCustomWeeks] = useState("");
  const [selectedReason, setSelectedReason] = useState<PauseReason | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const durations = [
    { key: "1_cycle" as PauseDuration, label: "1 Cycle", description: "Skip next contribution cycle" },
    { key: "2_cycles" as PauseDuration, label: "2 Cycles", description: "Skip next two contribution cycles" },
    { key: "1_month" as PauseDuration, label: "1 Month", description: "Approximately 4 weeks" },
    { key: "2_months" as PauseDuration, label: "2 Months", description: "Approximately 8 weeks" },
    { key: "custom" as PauseDuration, label: "Custom", description: "Specify number of weeks" },
  ];

  const reasons = [
    { key: "holiday" as PauseReason, label: "Holiday Season", icon: "sunny-outline" },
    { key: "emergency" as PauseReason, label: "Emergency", icon: "alert-circle-outline" },
    { key: "financial" as PauseReason, label: "Financial Review", icon: "wallet-outline" },
    { key: "reorganization" as PauseReason, label: "Circle Reorganization", icon: "people-outline" },
    { key: "other" as PauseReason, label: "Other Reason", icon: "ellipsis-horizontal" },
  ];

  const calculateResumeDate = () => {
    const today = new Date();
    let weeksToAdd = 0;

    switch (selectedDuration) {
      case "1_cycle":
        weeksToAdd = 2; // Assuming bi-weekly cycles
        break;
      case "2_cycles":
        weeksToAdd = 4;
        break;
      case "1_month":
        weeksToAdd = 4;
        break;
      case "2_months":
        weeksToAdd = 8;
        break;
      case "custom":
        weeksToAdd = parseInt(customWeeks) || 0;
        break;
    }

    today.setDate(today.getDate() + weeksToAdd * 7);
    return today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handlePauseCircle = () => {
    if (!selectedDuration || !selectedReason) {
      Alert.alert("Missing Information", "Please select both duration and reason.");
      return;
    }

    if (selectedDuration === "custom" && (!customWeeks || parseInt(customWeeks) < 1)) {
      Alert.alert("Invalid Duration", "Please enter a valid number of weeks.");
      return;
    }

    Alert.alert(
      "Confirm Pause",
      `Are you sure you want to pause "${circleName}"? All members will be notified and no contributions will be collected during this period.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Pause Circle",
          style: "destructive",
          onPress: () => {
            setIsSubmitting(true);
            setTimeout(() => {
              setIsSubmitting(false);
              setIsSubmitted(true);
            }, 1500);
          },
        },
      ]
    );
  };

  const renderConfirmation = () => (
    <View style={styles.confirmationContainer}>
      <View style={styles.confirmationIcon}>
        <Ionicons name="pause-circle" size={80} color="#F59E0B" />
      </View>

      <Text style={styles.confirmationTitle}>Circle Paused</Text>
      <Text style={styles.confirmationSubtitle}>
        {circleName} has been temporarily paused
      </Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Status</Text>
          <View style={styles.pausedBadge}>
            <Ionicons name="pause" size={14} color="#F59E0B" />
            <Text style={styles.pausedBadgeText}>On Hold</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Resume Date</Text>
          <Text style={styles.summaryValue}>{calculateResumeDate()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Paused At Cycle</Text>
          <Text style={styles.summaryValue}>
            {currentCycle} of {totalCycles}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Members Notified</Text>
          <Text style={styles.summaryValue}>{memberCount} members</Text>
        </View>
      </View>

      <View style={styles.whatHappensCard}>
        <Text style={styles.whatHappensTitle}>What Happens Now</Text>
        <View style={styles.whatHappensItem}>
          <Ionicons name="notifications-off-outline" size={20} color="#6B7280" />
          <Text style={styles.whatHappensText}>
            No contribution reminders will be sent
          </Text>
        </View>
        <View style={styles.whatHappensItem}>
          <Ionicons name="calendar-outline" size={20} color="#6B7280" />
          <Text style={styles.whatHappensText}>
            Payout schedule is postponed accordingly
          </Text>
        </View>
        <View style={styles.whatHappensItem}>
          <Ionicons name="mail-outline" size={20} color="#6B7280" />
          <Text style={styles.whatHappensText}>
            All members received email notification
          </Text>
        </View>
        <View style={styles.whatHappensItem}>
          <Ionicons name="alarm-outline" size={20} color="#6B7280" />
          <Text style={styles.whatHappensText}>
            You'll be reminded before the resume date
          </Text>
        </View>
      </View>

      <View style={styles.resumeInfo}>
        <Ionicons name="information-circle" size={20} color="#2563EB" />
        <Text style={styles.resumeInfoText}>
          You can resume the circle early at any time from Circle Settings.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.doneButtonText}>Return to Circle</Text>
      </TouchableOpacity>
    </View>
  );

  if (isSubmitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBackButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pause Circle</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderConfirmation()}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pause Circle</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <Ionicons name="pause-circle" size={24} color="#F59E0B" />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Temporarily Hold Circle</Text>
            <Text style={styles.warningText}>
              Pausing will stop all contributions and postpone payouts until
              resumed. All members will be notified.
            </Text>
          </View>
        </View>

        {/* Current Status */}
        <View style={styles.statusCard}>
          <Text style={styles.sectionTitle}>Current Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Circle</Text>
            <Text style={styles.statusValue}>{circleName}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Current Cycle</Text>
            <Text style={styles.statusValue}>
              {currentCycle} of {totalCycles}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Members</Text>
            <Text style={styles.statusValue}>{memberCount} active</Text>
          </View>
        </View>

        {/* Duration Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pause Duration</Text>
          <Text style={styles.sectionSubtitle}>
            How long should the circle be paused?
          </Text>

          {durations.map((duration) => (
            <TouchableOpacity
              key={duration.key}
              style={[
                styles.optionCard,
                selectedDuration === duration.key && styles.optionCardSelected,
              ]}
              onPress={() => setSelectedDuration(duration.key)}
            >
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionLabel,
                    selectedDuration === duration.key && styles.optionLabelSelected,
                  ]}
                >
                  {duration.label}
                </Text>
                <Text style={styles.optionDescription}>{duration.description}</Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  selectedDuration === duration.key && styles.radioOuterSelected,
                ]}
              >
                {selectedDuration === duration.key && (
                  <View style={styles.radioInner} />
                )}
              </View>
            </TouchableOpacity>
          ))}

          {selectedDuration === "custom" && (
            <View style={styles.customInputContainer}>
              <Text style={styles.customLabel}>Number of weeks:</Text>
              <TextInput
                style={styles.customInput}
                placeholder="e.g., 3"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={customWeeks}
                onChangeText={setCustomWeeks}
              />
            </View>
          )}

          {selectedDuration && (
            <View style={styles.resumeDatePreview}>
              <Ionicons name="calendar" size={18} color="#10B981" />
              <Text style={styles.resumeDateText}>
                Expected resume: {calculateResumeDate()}
              </Text>
            </View>
          )}
        </View>

        {/* Reason Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason for Pausing</Text>
          <Text style={styles.sectionSubtitle}>
            This will be shared with members
          </Text>

          <View style={styles.reasonGrid}>
            {reasons.map((reason) => (
              <TouchableOpacity
                key={reason.key}
                style={[
                  styles.reasonCard,
                  selectedReason === reason.key && styles.reasonCardSelected,
                ]}
                onPress={() => setSelectedReason(reason.key)}
              >
                <Ionicons
                  name={reason.icon as any}
                  size={24}
                  color={selectedReason === reason.key ? "#2563EB" : "#6B7280"}
                />
                <Text
                  style={[
                    styles.reasonLabel,
                    selectedReason === reason.key && styles.reasonLabelSelected,
                  ]}
                >
                  {reason.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Additional Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any message to members about the pause..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            value={additionalNotes}
            onChangeText={setAdditionalNotes}
            textAlignVertical="top"
          />
        </View>

        {/* Notification Toggle */}
        <View style={styles.toggleSection}>
          <View style={styles.toggleContent}>
            <Ionicons name="notifications-outline" size={24} color="#6B7280" />
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Notify All Members</Text>
              <Text style={styles.toggleDescription}>
                Send email notification to all circle members
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.toggle, notifyMembers && styles.toggleActive]}
            onPress={() => setNotifyMembers(!notifyMembers)}
          >
            <View
              style={[
                styles.toggleKnob,
                notifyMembers && styles.toggleKnobActive,
              ]}
            />
          </TouchableOpacity>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.pauseButton,
            (!selectedDuration || !selectedReason) && styles.pauseButtonDisabled,
          ]}
          onPress={handlePauseCircle}
          disabled={!selectedDuration || !selectedReason || isSubmitting}
        >
          {isSubmitting ? (
            <Text style={styles.pauseButtonText}>Processing...</Text>
          ) : (
            <>
              <Ionicons name="pause-circle" size={22} color="#FFFFFF" />
              <Text style={styles.pauseButtonText}>Pause Circle</Text>
            </>
          )}
        </TouchableOpacity>

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
  headerBackButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  warningBanner: {
    flexDirection: "row",
    backgroundColor: "#FFFBEB",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  warningContent: {
    marginLeft: 12,
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  statusLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  section: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },
  optionCardSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  optionLabelSelected: {
    color: "#2563EB",
  },
  optionDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  radioOuterSelected: {
    borderColor: "#2563EB",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2563EB",
  },
  customInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 12,
  },
  customLabel: {
    fontSize: 14,
    color: "#4B5563",
  },
  customInput: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1F2937",
  },
  resumeDatePreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  resumeDateText: {
    fontSize: 14,
    color: "#059669",
    fontWeight: "500",
  },
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  reasonCard: {
    width: "48%",
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  reasonCardSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  reasonLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  reasonLabelSelected: {
    color: "#2563EB",
    fontWeight: "500",
  },
  notesInput: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 16,
    fontSize: 14,
    color: "#1F2937",
    minHeight: 100,
  },
  toggleSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  toggleContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  toggleText: {
    marginLeft: 12,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  toggleDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#D1D5DB",
    padding: 2,
  },
  toggleActive: {
    backgroundColor: "#2563EB",
  },
  toggleKnob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },
  pauseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  pauseButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  pauseButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  bottomPadding: {
    height: 40,
  },
  confirmationContainer: {
    padding: 16,
    alignItems: "center",
  },
  confirmationIcon: {
    marginVertical: 24,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  confirmationSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  pausedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  pausedBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F59E0B",
  },
  whatHappensCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    marginBottom: 16,
  },
  whatHappensTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
  },
  whatHappensItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  whatHappensText: {
    flex: 1,
    fontSize: 14,
    color: "#4B5563",
  },
  resumeInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 8,
    width: "100%",
    marginBottom: 24,
    gap: 8,
  },
  resumeInfoText: {
    flex: 1,
    fontSize: 13,
    color: "#1E40AF",
  },
  doneButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
});
