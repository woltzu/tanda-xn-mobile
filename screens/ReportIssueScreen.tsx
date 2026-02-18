import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";
import { useAuth } from "../context/AuthContext";

type ReportIssueNavigationProp = StackNavigationProp<RootStackParamList>;
type ReportIssueRouteProp = RouteProp<RootStackParamList, "ReportIssue">;

type IssueCategory = "payment" | "member" | "technical" | "fraud" | "other";

interface ReportData {
  category: IssueCategory;
  title: string;
  description: string;
  involvedMembers: string[];
  urgency: "low" | "medium" | "high";
}

export default function ReportIssueScreen() {
  const navigation = useNavigation<ReportIssueNavigationProp>();
  const route = useRoute<ReportIssueRouteProp>();
  const { circleId } = route.params || {};
  const { circles, browseCircles, myCircles } = useCircles();
  const { user } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState<IssueCategory | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"low" | "medium" | "high">("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState("");

  // Find the circle
  const circle = circleId
    ? [...circles, ...myCircles, ...browseCircles].find((c) => c.id === circleId)
    : null;

  const categories: { id: IssueCategory; label: string; icon: string; description: string }[] = [
    { id: "payment", label: "Payment Issue", icon: "card-outline", description: "Late payment, missing funds, incorrect amounts" },
    { id: "member", label: "Member Dispute", icon: "people-outline", description: "Conflicts, disagreements, communication issues" },
    { id: "technical", label: "Technical Problem", icon: "bug-outline", description: "App errors, display issues, notifications" },
    { id: "fraud", label: "Suspicious Activity", icon: "warning-outline", description: "Fraud concerns, unauthorized access, scams" },
    { id: "other", label: "Other", icon: "ellipsis-horizontal-outline", description: "Any other issue not listed above" },
  ];

  const generateReportId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RPT-${timestamp}-${random}`;
  };

  const formatTimestamp = () => {
    const now = new Date();
    return now.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  };

  const handleSubmit = async () => {
    if (!selectedCategory) {
      Alert.alert("Select Category", "Please select an issue category.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Add Title", "Please provide a brief title for your report.");
      return;
    }
    if (!description.trim() || description.length < 20) {
      Alert.alert("Add Description", "Please provide a detailed description (at least 20 characters).");
      return;
    }

    setIsSubmitting(true);

    // Generate report ID and timestamp
    const newReportId = generateReportId();
    const timestamp = formatTimestamp();

    // Simulate API call to submit report
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // In production, this would:
    // 1. Save to database
    // 2. Send email confirmation to reporter
    // 3. Notify Elders/Admins
    // 4. Create audit trail entry

    setReportId(newReportId);
    setIsSubmitting(false);
    setSubmitted(true);

    // Simulate sending confirmation email
    console.log("Report submitted:", {
      reportId: newReportId,
      timestamp,
      category: selectedCategory,
      title,
      description,
      urgency,
      circleName: circle?.name,
      reportedBy: user?.email || user?.phone,
    });
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Report Submitted</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={80} color="#00C6AE" />
            </View>
            <Text style={styles.successTitle}>Report Received!</Text>
            <Text style={styles.successText}>
              Your report has been submitted successfully and sent to the Circle Elders for review.
            </Text>

            {/* Report Details Card */}
            <View style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Ionicons name="document-text" size={20} color="#0A2342" />
                <Text style={styles.reportCardTitle}>Report Details</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Report ID</Text>
                <Text style={styles.reportValue}>{reportId}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Submitted</Text>
                <Text style={styles.reportValue}>{formatTimestamp()}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Category</Text>
                <Text style={styles.reportValue}>
                  {categories.find((c) => c.id === selectedCategory)?.label}
                </Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Urgency</Text>
                <View style={[
                  styles.urgencyBadge,
                  { backgroundColor: urgency === "high" ? "#FEE2E2" : urgency === "medium" ? "#FEF3C7" : "#F0FDFB" }
                ]}>
                  <Text style={[
                    styles.urgencyBadgeText,
                    { color: urgency === "high" ? "#DC2626" : urgency === "medium" ? "#D97706" : "#00C6AE" }
                  ]}>
                    {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                  </Text>
                </View>
              </View>

              {circle && (
                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Circle</Text>
                  <Text style={styles.reportValue}>{circle.name}</Text>
                </View>
              )}
            </View>

            {/* Confirmation Notice */}
            <View style={styles.confirmationCard}>
              <Ionicons name="mail-outline" size={24} color="#6366F1" />
              <View style={styles.confirmationContent}>
                <Text style={styles.confirmationTitle}>Confirmation Email Sent</Text>
                <Text style={styles.confirmationText}>
                  A confirmation email has been sent to {user?.email || "your registered email"} with these details for your records.
                </Text>
              </View>
            </View>

            {/* What Happens Next */}
            <View style={styles.nextStepsCard}>
              <Text style={styles.nextStepsTitle}>What Happens Next?</Text>

              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Elder Review</Text>
                  <Text style={styles.stepText}>Circle Elders will review your report within 24-48 hours</Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Investigation</Text>
                  <Text style={styles.stepText}>Elders may contact you or other members for more information</Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Resolution</Text>
                  <Text style={styles.stepText}>You'll receive updates and final resolution via email and app notification</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report an Issue</Text>
          <View style={{ width: 40 }} />
        </View>
        {circle && (
          <View style={styles.circleInfo}>
            <Text style={styles.circleName}>{circle.emoji} {circle.name}</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Category Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What type of issue?</Text>
          <Text style={styles.sectionSubtitle}>Select the category that best describes your concern</Text>

          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryCard,
                selectedCategory === category.id && styles.categoryCardSelected,
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <View style={[
                styles.categoryIcon,
                selectedCategory === category.id && styles.categoryIconSelected,
              ]}>
                <Ionicons
                  name={category.icon as any}
                  size={24}
                  color={selectedCategory === category.id ? "#FFFFFF" : "#6B7280"}
                />
              </View>
              <View style={styles.categoryContent}>
                <Text style={[
                  styles.categoryLabel,
                  selectedCategory === category.id && styles.categoryLabelSelected,
                ]}>
                  {category.label}
                </Text>
                <Text style={styles.categoryDescription}>{category.description}</Text>
              </View>
              {selectedCategory === category.id && (
                <Ionicons name="checkmark-circle" size={24} color="#00C6AE" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Title Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Brief Title</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="e.g., Missing payment from John"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <Text style={styles.charCount}>{title.length}/100</Text>
        </View>

        {/* Description Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detailed Description</Text>
          <Text style={styles.sectionSubtitle}>
            Provide as much detail as possible to help Elders investigate
          </Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Describe what happened, when it occurred, who was involved..."
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length} characters (min 20)</Text>
        </View>

        {/* Urgency Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Urgency Level</Text>
          <View style={styles.urgencyContainer}>
            {(["low", "medium", "high"] as const).map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.urgencyOption,
                  urgency === level && styles.urgencyOptionSelected,
                  urgency === level && {
                    backgroundColor: level === "high" ? "#FEE2E2" : level === "medium" ? "#FEF3C7" : "#F0FDFB",
                    borderColor: level === "high" ? "#DC2626" : level === "medium" ? "#D97706" : "#00C6AE",
                  },
                ]}
                onPress={() => setUrgency(level)}
              >
                <Ionicons
                  name={level === "high" ? "alert-circle" : level === "medium" ? "time" : "checkmark-circle"}
                  size={20}
                  color={
                    urgency === level
                      ? level === "high" ? "#DC2626" : level === "medium" ? "#D97706" : "#00C6AE"
                      : "#6B7280"
                  }
                />
                <Text style={[
                  styles.urgencyText,
                  urgency === level && {
                    color: level === "high" ? "#DC2626" : level === "medium" ? "#D97706" : "#00C6AE",
                  },
                ]}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#6366F1" />
          <Text style={styles.privacyText}>
            Your report will be shared only with Circle Elders and Admins. Your identity will be protected unless disclosure is required for resolution.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedCategory || !title.trim() || description.length < 20 || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedCategory || !title.trim() || description.length < 20 || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send-outline" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Submit Report</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  circleInfo: {
    marginTop: 12,
    alignItems: "center",
  },
  circleName: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  categoryCardSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  categoryIconSelected: {
    backgroundColor: "#00C6AE",
  },
  categoryContent: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  categoryLabelSelected: {
    color: "#00C6AE",
  },
  categoryDescription: {
    fontSize: 12,
    color: "#6B7280",
  },
  titleInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#0A2342",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  charCount: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 4,
  },
  descriptionInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: "#0A2342",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 140,
  },
  urgencyContainer: {
    flexDirection: "row",
    gap: 10,
  },
  urgencyOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    gap: 6,
  },
  urgencyOptionSelected: {
    borderWidth: 2,
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  privacyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  submitButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Success Screen Styles
  successContainer: {
    alignItems: "center",
    paddingTop: 20,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 10,
  },
  successText: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  reportCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
  },
  reportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  reportLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  reportValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    maxWidth: "60%",
    textAlign: "right",
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urgencyBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  confirmationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    padding: 16,
    width: "100%",
    marginBottom: 16,
    gap: 12,
  },
  confirmationContent: {
    flex: 1,
  },
  confirmationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 4,
  },
  confirmationText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  nextStepsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  stepText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  doneButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 60,
    marginBottom: 40,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
});
