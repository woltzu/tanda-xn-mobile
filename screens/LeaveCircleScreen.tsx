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

interface LeaveCircleParams {
  circleName?: string;
  circleId?: string;
  memberPosition?: number;
  totalMembers?: number;
  currentCycle?: number;
  totalCycles?: number;
  hasReceivedPayout?: boolean;
}

type LeaveReason =
  | "financial"
  | "personal"
  | "relocation"
  | "dissatisfied"
  | "other";

export default function LeaveCircleScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params as LeaveCircleParams) || {};

  const circleName = params.circleName || "Family Savings Circle";
  const currentCycle = params.currentCycle || 3;
  const totalCycles = params.totalCycles || 12;
  const hasReceivedPayout = params.hasReceivedPayout ?? true;
  const memberPosition = params.memberPosition || 5;

  const [step, setStep] = useState(1);
  const [selectedReason, setSelectedReason] = useState<LeaveReason | null>(null);
  const [otherReason, setOtherReason] = useState("");
  const [acknowledged, setAcknowledged] = useState({
    noticePeriod: false,
    outstandingPayments: false,
    noRefund: false,
    finalDecision: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestId, setRequestId] = useState("");

  const reasons = [
    {
      key: "financial" as LeaveReason,
      label: "Financial Difficulties",
      icon: "wallet-outline",
      description: "Cannot continue with contributions",
    },
    {
      key: "personal" as LeaveReason,
      label: "Personal Reasons",
      icon: "person-outline",
      description: "Family or health-related matters",
    },
    {
      key: "relocation" as LeaveReason,
      label: "Relocating",
      icon: "airplane-outline",
      description: "Moving to a different area",
    },
    {
      key: "dissatisfied" as LeaveReason,
      label: "Dissatisfied with Circle",
      icon: "thumbs-down-outline",
      description: "Issues with management or members",
    },
    {
      key: "other" as LeaveReason,
      label: "Other Reason",
      icon: "ellipsis-horizontal",
      description: "Please specify below",
    },
  ];

  const noticePeriodDays = hasReceivedPayout ? 30 : 14;
  const outstandingCycles = hasReceivedPayout
    ? totalCycles - currentCycle
    : 0;
  const outstandingAmount = outstandingCycles * 100; // $100 per cycle

  const generateRequestId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LV-${timestamp}-${random}`;
  };

  const handleSubmitRequest = () => {
    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setRequestId(generateRequestId());
      setIsSubmitting(false);
      setRequestSubmitted(true);
    }, 1500);
  };

  const allAcknowledged = Object.values(acknowledged).every(Boolean);

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.warningBanner}>
        <Ionicons name="warning" size={24} color="#F59E0B" />
        <View style={styles.warningContent}>
          <Text style={styles.warningTitle}>Important Notice</Text>
          <Text style={styles.warningText}>
            Leaving a circle is a significant decision. Please review all terms
            carefully before proceeding.
          </Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Your Current Status</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Circle</Text>
          <Text style={styles.infoValue}>{circleName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Current Cycle</Text>
          <Text style={styles.infoValue}>
            {currentCycle} of {totalCycles}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Your Position</Text>
          <Text style={styles.infoValue}>#{memberPosition}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Payout Received</Text>
          <Text
            style={[
              styles.infoValue,
              { color: hasReceivedPayout ? "#10B981" : "#6B7280" },
            ]}
          >
            {hasReceivedPayout ? "Yes" : "Not Yet"}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Why are you leaving?</Text>
      <Text style={styles.sectionSubtitle}>
        Help us understand your reason for leaving
      </Text>

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
              size={24}
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
            {selectedReason === reason.key && (
              <View style={styles.radioInner} />
            )}
          </View>
        </TouchableOpacity>
      ))}

      {selectedReason === "other" && (
        <TextInput
          style={styles.otherInput}
          placeholder="Please specify your reason..."
          placeholderTextColor="#9CA3AF"
          value={otherReason}
          onChangeText={setOtherReason}
          multiline
          numberOfLines={3}
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
      <Text style={styles.sectionTitle}>Terms & Conditions</Text>
      <Text style={styles.sectionSubtitle}>
        Please acknowledge the following terms
      </Text>

      <View style={styles.termCard}>
        <View style={styles.termHeader}>
          <Ionicons name="time-outline" size={24} color="#2563EB" />
          <Text style={styles.termTitle}>Notice Period</Text>
        </View>
        <Text style={styles.termDescription}>
          You must provide <Text style={styles.termHighlight}>{noticePeriodDays} days</Text> notice
          before leaving the circle.
          {hasReceivedPayout
            ? " Since you have already received your payout, a longer notice period applies."
            : ""}
        </Text>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() =>
            setAcknowledged({ ...acknowledged, noticePeriod: !acknowledged.noticePeriod })
          }
        >
          <View
            style={[
              styles.checkbox,
              acknowledged.noticePeriod && styles.checkboxChecked,
            ]}
          >
            {acknowledged.noticePeriod && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.checkboxLabel}>
            I understand the {noticePeriodDays}-day notice period requirement
          </Text>
        </TouchableOpacity>
      </View>

      {hasReceivedPayout && outstandingCycles > 0 && (
        <View style={styles.termCard}>
          <View style={styles.termHeader}>
            <Ionicons name="cash-outline" size={24} color="#EF4444" />
            <Text style={styles.termTitle}>Outstanding Payments</Text>
          </View>
          <Text style={styles.termDescription}>
            Since you have received your payout, you are obligated to continue
            contributing for the remaining{" "}
            <Text style={styles.termHighlight}>{outstandingCycles} cycles</Text>{" "}
            (${outstandingAmount} total) before leaving.
          </Text>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() =>
              setAcknowledged({
                ...acknowledged,
                outstandingPayments: !acknowledged.outstandingPayments,
              })
            }
          >
            <View
              style={[
                styles.checkbox,
                acknowledged.outstandingPayments && styles.checkboxChecked,
              ]}
            >
              {acknowledged.outstandingPayments && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>
              I will fulfill my remaining payment obligations
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.termCard}>
        <View style={styles.termHeader}>
          <Ionicons name="ban-outline" size={24} color="#F59E0B" />
          <Text style={styles.termTitle}>No Refunds</Text>
        </View>
        <Text style={styles.termDescription}>
          Contributions already made to the circle cannot be refunded upon
          leaving. All past payments remain with the circle pool.
        </Text>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() =>
            setAcknowledged({ ...acknowledged, noRefund: !acknowledged.noRefund })
          }
        >
          <View
            style={[
              styles.checkbox,
              acknowledged.noRefund && styles.checkboxChecked,
            ]}
          >
            {acknowledged.noRefund && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.checkboxLabel}>
            I understand there are no refunds for past contributions
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.termCard}>
        <View style={styles.termHeader}>
          <Ionicons name="alert-circle-outline" size={24} color="#DC2626" />
          <Text style={styles.termTitle}>Final Decision</Text>
        </View>
        <Text style={styles.termDescription}>
          Once your leave request is approved, this action cannot be undone. You
          will need to request to rejoin and may be placed at the end of the
          queue.
        </Text>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() =>
            setAcknowledged({
              ...acknowledged,
              finalDecision: !acknowledged.finalDecision,
            })
          }
        >
          <View
            style={[
              styles.checkbox,
              acknowledged.finalDecision && styles.checkboxChecked,
            ]}
          >
            {acknowledged.finalDecision && (
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            )}
          </View>
          <Text style={styles.checkboxLabel}>
            I understand this is a final decision
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep(1)}
        >
          <Ionicons name="arrow-back" size={20} color="#6B7280" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!allAcknowledged || !hasReceivedPayout && !acknowledged.noRefund && !acknowledged.noticePeriod && !acknowledged.finalDecision) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmitRequest}
          disabled={!allAcknowledged || isSubmitting}
        >
          {isSubmitting ? (
            <Text style={styles.submitButtonText}>Submitting...</Text>
          ) : (
            <>
              <Text style={styles.submitButtonText}>Submit Request</Text>
              <Ionicons name="exit-outline" size={20} color="#FFFFFF" />
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

      <Text style={styles.confirmationTitle}>Request Submitted</Text>
      <Text style={styles.confirmationSubtitle}>
        Your leave request has been submitted to the Circle Admin and Elders for
        review.
      </Text>

      <View style={styles.requestCard}>
        <Text style={styles.requestLabel}>Request ID</Text>
        <Text style={styles.requestId}>{requestId}</Text>
        <Text style={styles.requestTimestamp}>
          Submitted on {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      <View style={styles.nextStepsCard}>
        <Text style={styles.nextStepsTitle}>What Happens Next</Text>
        <View style={styles.nextStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <Text style={styles.stepText}>
            Circle Admin will review your request within 48 hours
          </Text>
        </View>
        <View style={styles.nextStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <Text style={styles.stepText}>
            Your {noticePeriodDays}-day notice period begins upon approval
          </Text>
        </View>
        <View style={styles.nextStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <Text style={styles.stepText}>
            You'll receive email confirmation at each step
          </Text>
        </View>
        {hasReceivedPayout && (
          <View style={styles.nextStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <Text style={styles.stepText}>
              Complete remaining payments during notice period
            </Text>
          </View>
        )}
      </View>

      <View style={styles.emailNotice}>
        <Ionicons name="mail-outline" size={20} color="#2563EB" />
        <Text style={styles.emailNoticeText}>
          A confirmation email has been sent to your registered email address
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => {
            if (requestSubmitted) {
              navigation.goBack();
            } else if (step > 1) {
              setStep(step - 1);
            } else {
              Alert.alert(
                "Cancel Request",
                "Are you sure you want to cancel your leave request?",
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
        <Text style={styles.headerTitle}>Leave Circle</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {!requestSubmitted && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: step === 1 ? "50%" : "100%" }]}
            />
          </View>
          <Text style={styles.progressText}>Step {step} of 2</Text>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {requestSubmitted
          ? renderConfirmation()
          : step === 1
          ? renderStep1()
          : renderStep2()}
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
    backgroundColor: "#2563EB",
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
  warningBanner: {
    flexDirection: "row",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  infoLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  reasonCardSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  reasonIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  reasonIconSelected: {
    backgroundColor: "#2563EB",
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
    color: "#2563EB",
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
    borderColor: "#2563EB",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2563EB",
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
    textAlignVertical: "top",
    marginBottom: 16,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  continueButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  termCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  termHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  termTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginLeft: 12,
  },
  termDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 16,
  },
  termHighlight: {
    fontWeight: "600",
    color: "#1F2937",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
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
  submitButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  submitButtonText: {
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
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  requestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  requestLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  requestId: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2563EB",
    fontFamily: "monospace",
    marginBottom: 8,
  },
  requestTimestamp: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  nextStepsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    marginBottom: 20,
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
  },
  nextStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  emailNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 8,
    width: "100%",
    marginBottom: 24,
    gap: 8,
  },
  emailNoticeText: {
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
