import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { useDocumentSubmission } from "../hooks/useTripOrganizer";

const TEAL = colors.accentTeal;
const NAVY = colors.primaryNavy;
const GOLD = "#E8A842";

// ── Types ──────────────────────────────────────────────────────────────────────
type UploadState = "empty" | "selected" | "uploading" | "submitted";

interface SelectedFile {
  uri: string;
  name: string;
  size: string;
  type: string;
}

interface DocRequirement {
  title: string;
  description: string;
  acceptedFormats: string;
}

// ── Mock Data ──────────────────────────────────────────────────────────────────
const DOC_REQUIREMENTS: Record<string, DocRequirement> = {
  passport: {
    title: "Passport Copy",
    description:
      "Please upload a clear, high-resolution photo or scan of the photo page of your passport. The document must be valid for at least 6 months past your travel date (Aug 16, 2026). Ensure all text and your photo are clearly visible.",
    acceptedFormats: "JPG, PNG, or PDF (max 10MB)",
  },
  visa: {
    title: "Visa Document",
    description:
      "Upload your approved visa or visa confirmation. If you have not yet applied, upload your visa appointment confirmation.",
    acceptedFormats: "JPG, PNG, or PDF (max 10MB)",
  },
  vaccination: {
    title: "Vaccination Record",
    description:
      "Upload your yellow fever vaccination certificate or WHO International Certificate of Vaccination.",
    acceptedFormats: "JPG, PNG, or PDF (max 10MB)",
  },
};

// ── Component ──────────────────────────────────────────────────────────────────
const DocumentSubmissionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const tripId = route.params?.tripId ?? "trip-001";
  const participantId = route.params?.participantId ?? "me";
  const fieldKey = route.params?.fieldKey ?? "passport";

  const hookResult = useDocumentSubmission(participantId, tripId);
  const submitDoc = (hookResult as any)?.submitDocument ?? (async () => {});

  const docReq = DOC_REQUIREMENTS[fieldKey] ?? DOC_REQUIREMENTS.passport;

  const [uploadState, setUploadState] = useState<UploadState>("empty");
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const pickDocument = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.uri.split("/").pop() ?? "document";
        const fileSize = asset.fileSize
          ? `${(asset.fileSize / 1024 / 1024).toFixed(1)} MB`
          : "Unknown size";

        setSelectedFile({
          uri: asset.uri,
          name: fileName,
          size: fileSize,
          type: asset.mimeType ?? "image/jpeg",
        });
        setUploadState("selected");
      }
    } catch {
      Alert.alert("Error", "Could not access your photo library. Please check permissions.");
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Camera access is needed to take a photo.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = `${fieldKey}_photo_${Date.now()}.jpg`;
        const fileSize = asset.fileSize
          ? `${(asset.fileSize / 1024 / 1024).toFixed(1)} MB`
          : "Unknown size";

        setSelectedFile({
          uri: asset.uri,
          name: fileName,
          size: fileSize,
          type: "image/jpeg",
        });
        setUploadState("selected");
      }
    } catch {
      Alert.alert("Error", "Could not access the camera. Please check permissions.");
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setUploadState("uploading");
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + Math.random() * 20;
      });
    }, 300);

    try {
      await submitDoc(fieldKey, selectedFile.type, { uri: selectedFile.uri, name: selectedFile.name });
      clearInterval(interval);
      setUploadProgress(100);
      setUploadState("submitted");
    } catch {
      clearInterval(interval);
      setUploadState("selected");
      Alert.alert("Upload Failed", "Please check your connection and try again.");
    }
  };

  const isSubmitDisabled = uploadState !== "selected";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{docReq.title}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Requirements ────────────────────────────────────────────── */}
        <View style={styles.requirementsCard}>
          <View style={styles.requirementsHeader}>
            <Ionicons name="document-text-outline" size={20} color={NAVY} />
            <Text style={styles.requirementsTitle}>Requirements</Text>
          </View>
          <Text style={styles.requirementsDescription}>{docReq.description}</Text>
          <View style={styles.formatRow}>
            <Ionicons name="attach" size={14} color={colors.textSecondary} />
            <Text style={styles.formatText}>Accepted: {docReq.acceptedFormats}</Text>
          </View>
        </View>

        {/* ── Upload Box ──────────────────────────────────────────────── */}
        <View style={styles.uploadSection}>
          <Text style={styles.uploadSectionTitle}>Upload Document</Text>

          {uploadState === "empty" && (
            <TouchableOpacity style={styles.uploadBox} onPress={pickDocument} activeOpacity={0.7}>
              <Ionicons name="document-outline" size={40} color={TEAL} />
              <Text style={styles.uploadBoxTitle}>Tap to select a file</Text>
              <Text style={styles.uploadBoxSubtitle}>
                Choose from your photo library
              </Text>
            </TouchableOpacity>
          )}

          {uploadState === "selected" && selectedFile && (
            <View style={styles.selectedBox}>
              <View style={styles.selectedFileRow}>
                <View style={styles.fileIconBox}>
                  <Ionicons name="document" size={24} color={TEAL} />
                </View>
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={styles.fileSize}>{selectedFile.size}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedFile(null);
                    setUploadState("empty");
                  }}
                  style={styles.removeBtn}
                >
                  <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {uploadState === "uploading" && (
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="small" color={TEAL} />
              <Text style={styles.uploadingText}>Uploading...</Text>
              <View style={styles.uploadProgressBar}>
                <View
                  style={[
                    styles.uploadProgressFill,
                    { width: `${Math.min(uploadProgress, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.uploadProgressText}>
                {Math.round(Math.min(uploadProgress, 100))}%
              </Text>
            </View>
          )}

          {uploadState === "submitted" && (
            <View style={styles.submittedBox}>
              <View style={styles.submittedIcon}>
                <Ionicons name="checkmark-circle" size={48} color={TEAL} />
              </View>
              <Text style={styles.submittedTitle}>Document Submitted</Text>
              <Text style={styles.submittedSubtitle}>
                Your {docReq.title.toLowerCase()} has been received and is being reviewed.
              </Text>
            </View>
          )}
        </View>

        {/* ── OR Take a Photo ─────────────────────────────────────────── */}
        {(uploadState === "empty" || uploadState === "selected") && (
          <View style={styles.orSection}>
            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR TAKE A PHOTO</Text>
              <View style={styles.orLine} />
            </View>
            <TouchableOpacity style={styles.cameraButton} onPress={takePhoto} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={22} color={NAVY} />
              <Text style={styles.cameraButtonText}>Open Camera</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Security Note ───────────────────────────────────────────── */}
        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={16} color={colors.textSecondary} />
          <Text style={styles.securityText}>
            Your document is stored securely and only visible to your trip organizer.
          </Text>
        </View>
      </ScrollView>

      {/* ── Submit Button ─────────────────────────────────────────────── */}
      {uploadState !== "submitted" && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.submitButton, isSubmitDisabled && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitDisabled}
            activeOpacity={0.85}
          >
            {uploadState === "uploading" ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
                <Text style={styles.submitButtonText}>Submit Document</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {uploadState === "submitted" && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: NAVY }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={20} color="#FFF" />
            <Text style={styles.submitButtonText}>Back to My Trip</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default DocumentSubmissionScreen;

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },

  // ── Requirements ──
  requirementsCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    borderRadius: radius.card,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  requirementsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  requirementsTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
  },
  requirementsDescription: {
    fontSize: typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  formatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  formatText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },

  // ── Upload Section ──
  uploadSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  uploadSectionTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: 12,
  },

  // ── Upload Box (empty) ──
  uploadBox: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: TEAL,
    borderStyle: "dashed",
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadBoxTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: NAVY,
    marginTop: 12,
  },
  uploadBoxSubtitle: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // ── Selected File ──
  selectedBox: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: TEAL,
    padding: 16,
  },
  selectedFileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fileIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.small,
    backgroundColor: "rgba(0,198,174,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
    marginBottom: 2,
  },
  fileSize: {
    fontSize: typography.label,
    color: colors.textSecondary,
  },
  removeBtn: {
    padding: 4,
  },

  // ── Uploading State ──
  uploadingBox: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 24,
    alignItems: "center",
  },
  uploadingText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
    marginTop: 10,
    marginBottom: 16,
  },
  uploadProgressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "rgba(0,198,174,0.12)",
    borderRadius: 4,
    overflow: "hidden",
  },
  uploadProgressFill: {
    height: "100%",
    backgroundColor: TEAL,
    borderRadius: 4,
  },
  uploadProgressText: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 8,
  },

  // ── Submitted State ──
  submittedBox: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 32,
    alignItems: "center",
  },
  submittedIcon: {
    marginBottom: 12,
  },
  submittedTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: 6,
  },
  submittedSubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── OR Section ──
  orSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    fontSize: typography.label,
    fontWeight: typography.bold,
    color: colors.textSecondary,
    marginHorizontal: 12,
    letterSpacing: 1,
  },
  cameraButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.cardBg,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 14,
  },
  cameraButtonText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
  },

  // ── Security Note ──
  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.softerNavyTintBg,
    borderRadius: radius.small,
  },
  securityText: {
    fontSize: typography.label,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 17,
  },

  // ── Bottom Bar ──
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TEAL,
    paddingVertical: 16,
    borderRadius: radius.button,
  },
  submitButtonDisabled: {
    backgroundColor: "rgba(0,198,174,0.4)",
  },
  submitButtonText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: "#FFF",
  },
});
