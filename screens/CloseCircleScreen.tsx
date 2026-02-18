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

interface CloseCircleParams {
  circleName?: string;
  circleId?: string;
  currentCycle?: number;
  totalCycles?: number;
  memberCount?: number;
  totalContributed?: number;
  outstandingPayouts?: number;
}

type CloseReason =
  | "completed"
  | "members_left"
  | "financial_issues"
  | "disputes"
  | "inactivity"
  | "other";

type CloseMethod = "immediate" | "after_payouts" | "after_cycle";

export default function CloseCircleScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params as CloseCircleParams) || {};

  const circleName = params.circleName || "Family Savings Circle";
  const currentCycle = params.currentCycle || 8;
  const totalCycles = params.totalCycles || 12;
  const memberCount = params.memberCount || 6;
  const totalContributed = params.totalContributed || 4800;
  const outstandingPayouts = params.outstandingPayouts || 4;

  const [step, setStep] = useState(1);
  const [selectedReason, setSelectedReason] = useState<CloseReason | null>(null);
  const [otherReason, setOtherReason] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<CloseMethod | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [exportData, setExportData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const reasons = [
    {
      key: "completed" as CloseReason,
      label: "Circle Completed",
      icon: "checkmark-circle-outline",
      description: "All cycles finished successfully",
    },
    {
      key: "members_left" as CloseReason,
      label: "Insufficient Members",
      icon: "people-outline",
      description: "Not enough members to continue",
    },
    {
      key: "financial_issues" as CloseReason,
      label: "Financial Issues",
      icon: "wallet-outline",
      description: "Payment defaults or disputes",
    },
    {
      key: "disputes" as CloseReason,
      label: "Member Disputes",
      icon: "alert-circle-outline",
      description: "Unresolved conflicts between members",
    },
    {
      key: "inactivity" as CloseReason,
      label: "Inactivity",
      icon: "time-outline",
      description: "Circle has been inactive",
    },
    {
      key: "other" as CloseReason,
      label: "Other Reason",
      icon: "ellipsis-horizontal",
      description: "Please specify below",
    },
  ];

  const closeMethods = [
    {
      key: "immediate" as CloseMethod,
      label: "Close Immediately",
      description: "End the circle now. Outstanding obligations remain.",
      warning: "Members with pending payouts will need to be settled separately.",
      icon: "flash-outline",
    },
    {
      key: "after_payouts" as CloseMethod,
      label: "After All Payouts",
      description: "Continue until all members receive their payouts.",
      detail: `${outstandingPayouts} payouts remaining`,
      icon: "cash-outline",
    },
    {
      key: "after_cycle" as CloseMethod,
      label: "After Current Cycle",
      description: "Complete current cycle then close.",
      detail: `Cycle ${currentCycle} of ${totalCycles}`,
      icon: "refresh-outline",
    },
  ];

  const handleClose = () => {
    if (confirmText !== "CLOSE") {
      Alert.alert("Confirmation Required", "Please type CLOSE to confirm.");
      return;
    }

    Alert.alert(
      "Final Confirmation",
      `This action will permanently close "${circleName}". This cannot be undone. Are you absolutely sure?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close Circle",
          style: "destructive",
          onPress: () => {
            setIsSubmitting(true);
            setTimeout(() => {
              setIsSubmitting(false);
              setIsSubmitted(true);
            }, 2000);
          },
        },
      ]
    );
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      {/* Danger Warning */}
      <View style={styles.dangerBanner}>
        <Ionicons name="warning" size={24} color="#DC2626" />
        <View style={styles.dangerContent}>
          <Text style={styles.dangerTitle}>Permanent Action</Text>
          <Text style={styles.dangerText}>
            Closing a circle is irreversible. All data will be archived and the
            circle cannot be reopened.
          </Text>
        </View>
      </View>

      {/* Circle Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>Circle Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{memberCount}</Text>
            <Text style={styles.summaryLabel}>Members</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {currentCycle}/{totalCycles}
            </Text>
            <Text style={styles.summaryLabel}>Cycles</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>${totalContributed}</Text>
            <Text style={styles.summaryLabel}>Contributed</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{outstandingPayouts}</Text>
            <Text style={styles.summaryLabel}>Pending Payouts</Text>
          </View>
        </View>
      </View>

      {/* Reason Selection */}
      <Text style={styles.sectionTitle}>Reason for Closing</Text>
      <Text style={styles.sectionSubtitle}>This will be recorded in the audit log</Text>

      {reasons.map((reason) => (
        <TouchableOpacity
          key={reason.key}
          style={[
            styles.reasonCard,
            selectedReason === reason.key && styles.reasonCardSelected,
          ]}
          onPress={() => setSelectedReason(reason.key)}
        >
          <View
            style={[
              styles.reasonIcon,
              selectedReason === reason.key && styles.reasonIconSelected,
            ]}
          >
            <Ionicons
              name={reason.icon as any}
              size={22}
              color={selectedReason === reason.key ? "#FFFFFF" : "#6B7280"}
            />
          </View>
          <View style={styles.reasonContent}>
            <Text
              style={[
                styles.reasonLabel,
                selectedReason === reason.key && styles.reasonLabelSelected,
              ]}
            >
              {reason.label}
            </Text>
            <Text style={styles.reasonDescription}>{reason.description}</Text>
          </View>
          <View
            style={[
              styles.radioOuter,
              selectedReason === reason.key && styles.radioOuterSelected,
            ]}
          >
            {selectedReason === reason.key && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
      ))}

      {selectedReason === "other" && (
        <TextInput
          style={styles.otherInput}
          placeholder="Please explain the reason..."
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
          value={otherReason}
          onChangeText={setOtherReason}
          textAlignVertical="top"
        />
      )}

      <TouchableOpacity
        style={[
          styles.continueButton,
          !selectedReason && styles.continueButtonDisabled,
        ]}
        onPress={() => setStep(2)}
        disabled={!selectedReason}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.sectionTitle}>Closure Method</Text>
      <Text style={styles.sectionSubtitle}>
        How would you like to close this circle?
      </Text>

      {closeMethods.map((method) => (
        <TouchableOpacity
          key={method.key}
          style={[
            styles.methodCard,
            selectedMethod === method.key && styles.methodCardSelected,
          ]}
          onPress={() => setSelectedMethod(method.key)}
        >
          <View style={styles.methodHeader}>
            <View
              style={[
                styles.methodIcon,
                selectedMethod === method.key && styles.methodIconSelected,
              ]}
            >
              <Ionicons
                name={method.icon as any}
                size={24}
                color={selectedMethod === method.key ? "#FFFFFF" : "#6B7280"}
              />
            </View>
            <View style={styles.methodContent}>
              <Text
                style={[
                  styles.methodLabel,
                  selectedMethod === method.key && styles.methodLabelSelected,
                ]}
              >
                {method.label}
              </Text>
              <Text style={styles.methodDescription}>{method.description}</Text>
              {method.detail && (
                <Text style={styles.methodDetail}>{method.detail}</Text>
              )}
            </View>
            <View
              style={[
                styles.radioOuter,
                selectedMethod === method.key && styles.radioOuterSelected,
              ]}
            >
              {selectedMethod === method.key && <View style={styles.radioInner} />}
            </View>
          </View>
          {method.warning && selectedMethod === method.key && (
            <View style={styles.methodWarning}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.methodWarningText}>{method.warning}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}

      {/* Options */}
      <View style={styles.optionsSection}>
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => setNotifyMembers(!notifyMembers)}
        >
          <View style={styles.optionContent}>
            <Ionicons name="notifications-outline" size={22} color="#6B7280" />
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>Notify All Members</Text>
              <Text style={styles.optionDescription}>
                Send email notification about closure
              </Text>
            </View>
          </View>
          <View style={[styles.checkbox, notifyMembers && styles.checkboxChecked]}>
            {notifyMembers && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => setExportData(!exportData)}
        >
          <View style={styles.optionContent}>
            <Ionicons name="download-outline" size={22} color="#6B7280" />
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>Export Circle Data</Text>
              <Text style={styles.optionDescription}>
                Download complete transaction history
              </Text>
            </View>
          </View>
          <View style={[styles.checkbox, exportData && styles.checkboxChecked]}>
            {exportData && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
          <Ionicons name="arrow-back" size={20} color="#6B7280" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.continueButton,
            styles.continueButtonFlex,
            !selectedMethod && styles.continueButtonDisabled,
          ]}
          onPress={() => setStep(3)}
          disabled={!selectedMethod}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.finalWarning}>
        <Ionicons name="skull-outline" size={48} color="#DC2626" />
        <Text style={styles.finalWarningTitle}>Point of No Return</Text>
        <Text style={styles.finalWarningText}>
          You are about to permanently close "{circleName}". This action cannot
          be undone.
        </Text>
      </View>

      {/* Final Summary */}
      <View style={styles.finalSummary}>
        <Text style={styles.finalSummaryTitle}>Closure Summary</Text>
        <View style={styles.finalRow}>
          <Text style={styles.finalLabel}>Circle</Text>
          <Text style={styles.finalValue}>{circleName}</Text>
        </View>
        <View style={styles.finalRow}>
          <Text style={styles.finalLabel}>Reason</Text>
          <Text style={styles.finalValue}>
            {reasons.find((r) => r.key === selectedReason)?.label}
          </Text>
        </View>
        <View style={styles.finalRow}>
          <Text style={styles.finalLabel}>Method</Text>
          <Text style={styles.finalValue}>
            {closeMethods.find((m) => m.key === selectedMethod)?.label}
          </Text>
        </View>
        <View style={styles.finalRow}>
          <Text style={styles.finalLabel}>Notify Members</Text>
          <Text style={styles.finalValue}>{notifyMembers ? "Yes" : "No"}</Text>
        </View>
        <View style={styles.finalRow}>
          <Text style={styles.finalLabel}>Export Data</Text>
          <Text style={styles.finalValue}>{exportData ? "Yes" : "No"}</Text>
        </View>
      </View>

      {/* Confirmation Input */}
      <View style={styles.confirmSection}>
        <Text style={styles.confirmLabel}>
          Type <Text style={styles.confirmHighlight}>CLOSE</Text> to confirm
        </Text>
        <TextInput
          style={styles.confirmInput}
          placeholder="Type CLOSE here"
          placeholderTextColor="#9CA3AF"
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep(2)}>
          <Ionicons name="arrow-back" size={20} color="#6B7280" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.closeButton,
            confirmText !== "CLOSE" && styles.closeButtonDisabled,
          ]}
          onPress={handleClose}
          disabled={confirmText !== "CLOSE" || isSubmitting}
        >
          {isSubmitting ? (
            <Text style={styles.closeButtonText}>Closing...</Text>
          ) : (
            <>
              <Ionicons name="close-circle" size={20} color="#FFFFFF" />
              <Text style={styles.closeButtonText}>Close Circle</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.confirmationContainer}>
      <View style={styles.confirmationIcon}>
        <Ionicons name="checkmark-circle" size={80} color="#10B981" />
      </View>

      <Text style={styles.confirmationTitle}>Circle Closed</Text>
      <Text style={styles.confirmationSubtitle}>
        {circleName} has been permanently closed
      </Text>

      <View style={styles.closureCard}>
        <Text style={styles.closureLabel}>Closure Reference</Text>
        <Text style={styles.closureId}>
          CLO-{Date.now().toString().substring(5)}
        </Text>
        <Text style={styles.closureTimestamp}>
          Closed on{" "}
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      <View style={styles.actionsCard}>
        <Text style={styles.actionsTitle}>Actions Completed</Text>
        <View style={styles.actionItem}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.actionText}>Circle archived</Text>
        </View>
        {notifyMembers && (
          <View style={styles.actionItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.actionText}>
              {memberCount} members notified via email
            </Text>
          </View>
        )}
        {exportData && (
          <View style={styles.actionItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.actionText}>
              Data exported and sent to your email
            </Text>
          </View>
        )}
        <View style={styles.actionItem}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.actionText}>Audit trail recorded</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => {
          // Navigate to home or circles list
          navigation.goBack();
        }}
      >
        <Text style={styles.doneButtonText}>Return to Home</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => {
            if (isSubmitted) {
              navigation.goBack();
            } else if (step > 1) {
              setStep(step - 1);
            } else {
              Alert.alert(
                "Cancel",
                "Are you sure you want to cancel closing this circle?",
                [
                  { text: "Stay", style: "cancel" },
                  { text: "Cancel", onPress: () => navigation.goBack() },
                ]
              );
            }
          }}
        >
          <Ionicons name="close" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Close Circle</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {!isSubmitted && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(step / 3) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>Step {step} of 3</Text>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isSubmitted
          ? renderConfirmation()
          : step === 1
          ? renderStep1()
          : step === 2
          ? renderStep2()
          : renderStep3()}
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
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  progressBar: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#DC2626",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 16,
  },
  dangerBanner: {
    flexDirection: "row",
    backgroundColor: "#FEF2F2",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  dangerContent: {
    marginLeft: 12,
    flex: 1,
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DC2626",
    marginBottom: 4,
  },
  dangerText: {
    fontSize: 14,
    color: "#DC2626",
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  summaryItem: {
    width: "50%",
    alignItems: "center",
    paddingVertical: 12,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  reasonCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  reasonCardSelected: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  reasonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  reasonIconSelected: {
    backgroundColor: "#DC2626",
  },
  reasonContent: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  reasonLabelSelected: {
    color: "#DC2626",
  },
  reasonDescription: {
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
    borderColor: "#DC2626",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#DC2626",
  },
  otherInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: "#1F2937",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 100,
    marginBottom: 16,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  continueButtonFlex: {
    flex: 1,
  },
  continueButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  methodCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  methodCardSelected: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  methodHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  methodIconSelected: {
    backgroundColor: "#DC2626",
  },
  methodContent: {
    flex: 1,
  },
  methodLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  methodLabelSelected: {
    color: "#DC2626",
  },
  methodDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
    lineHeight: 20,
  },
  methodDetail: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "500",
    marginTop: 4,
  },
  methodWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  methodWarningText: {
    flex: 1,
    fontSize: 12,
    color: "#DC2626",
  },
  optionsSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  optionText: {
    marginLeft: 12,
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1F2937",
  },
  optionDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#DC2626",
    borderColor: "#DC2626",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  finalWarning: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  finalWarningTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#DC2626",
    marginTop: 12,
    marginBottom: 8,
  },
  finalWarningText: {
    fontSize: 14,
    color: "#DC2626",
    textAlign: "center",
    lineHeight: 20,
  },
  finalSummary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  finalSummaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  finalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  finalLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  finalValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  confirmSection: {
    marginBottom: 20,
  },
  confirmLabel: {
    fontSize: 14,
    color: "#4B5563",
    marginBottom: 8,
  },
  confirmHighlight: {
    fontWeight: "700",
    color: "#DC2626",
  },
  confirmInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  closeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  closeButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
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
  closureCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  closureLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  closureId: {
    fontSize: 20,
    fontWeight: "700",
    color: "#DC2626",
    fontFamily: "monospace",
    marginBottom: 8,
  },
  closureTimestamp: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  actionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    marginBottom: 24,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  actionText: {
    fontSize: 14,
    color: "#4B5563",
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
