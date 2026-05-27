// ══════════════════════════════════════════════════════════════════════════════
// screens/DocumentUploadScreen.tsx — KYC-008 ID document capture/upload
// ══════════════════════════════════════════════════════════════════════════════
//
// Route params: { idType: IDDocType; side: 'front' | 'back' }
//
// The screen is reached twice per ID — first for the front side, then
// pushed again for the back. After the back is captured, the user lands
// on Tier2Success.
//
// ───── Phase KYC-1 placeholder note ─────
// Real camera (expo-camera) and file-picker (expo-image-picker)
// integration lands in Phase KYC-2. For this commit the dark camera
// pane is rendered with the original document-frame overlay, corner
// markers, tips, and mode toggle — but tapping the bottom "Capture"
// or "Choose File" button shows an Alert acknowledging the placeholder
// and, on OK, navigates forward as if capture succeeded. This lets
// the full nav flow be tested end-to-end without taking the camera
// dependency.
// ────────────────────────────────────────
//
// Translated from KYC screens/08_DocumentUpload.jsx.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import type { IDDocType } from "./IDVerificationStartScreen";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const CAMERA_BG = "#1a3a5c";

type Side = "front" | "back";
type CaptureMode = "camera" | "upload";

type DocumentUploadParams = {
  idType: IDDocType;
  side: Side;
};
type DocumentUploadRouteProp = RouteProp<
  { DocumentUpload: DocumentUploadParams },
  "DocumentUpload"
>;

const ID_TYPE_LABELS: Record<IDDocType, string> = {
  passport: "Passport",
  "national-id": "National ID Card",
  "drivers-license": "Driver's License",
  "residence-permit": "Residence Permit",
};

const TIPS: Record<Side, string[]> = {
  front: [
    "Place document on a flat, dark surface",
    "Make sure all 4 corners are visible",
    "Avoid glare and shadows",
    "Text should be readable",
  ],
  back: [
    "Flip your document over",
    "Capture the full back side",
    "Include any barcodes or chips",
  ],
};

export default function DocumentUploadScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<DocumentUploadRouteProp>();
  const idType = route.params?.idType ?? "passport";
  const side = route.params?.side ?? "front";

  const [captureMode, setCaptureMode] = useState<CaptureMode>("camera");

  const idTypeLabel = ID_TYPE_LABELS[idType] ?? "Document";
  const tipsForSide = TIPS[side];

  // ── Placeholder action ──────────────────────────────────────────────────
  // KYC-2 will replace this with actual camera/image-picker integration.
  // For now we acknowledge the placeholder, then navigate forward.
  const handleAction = () => {
    const actionVerb = captureMode === "camera" ? "Camera" : "File upload";
    Alert.alert(
      `${actionVerb} not yet wired`,
      "Camera and file-upload will be implemented in Phase KYC-2. For now we'll simulate a successful capture and move on.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => {
            if (side === "front") {
              // Push a new instance so back-button takes the user back to
              // the front capture (rather than reusing the same instance).
              navigation.push(Routes.DocumentUpload, {
                idType,
                side: "back",
              });
            } else {
              navigation.navigate(Routes.Tier2Success);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{idTypeLabel}</Text>
          <Text style={styles.headerSubtitle}>
            {side === "front" ? "Front Side" : "Back Side"}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Camera/Upload Area */}
        <View style={styles.contentWrap}>
          <View
            style={[
              styles.cameraPane,
              {
                aspectRatio: idType === "passport" ? 4 / 3 : 3 / 2,
              },
            ]}
          >
            {/* Document frame overlay */}
            <View
              style={[
                styles.documentFrame,
                {
                  borderRadius: idType === "passport" ? 12 : 8,
                },
              ]}
            >
              {/* Document icon */}
              <View style={styles.documentIconBox}>
                <Ionicons
                  name="document-text-outline"
                  size={32}
                  color="rgba(255,255,255,0.5)"
                />
              </View>
              <Text style={styles.positionText}>
                Position {idTypeLabel.toLowerCase()} here
              </Text>
            </View>

            {/* Corner markers */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>

          {/* Tips */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Tips for a clear capture</Text>
            <View style={styles.tipsList}>
              {tipsForSide.map((tip, idx) => (
                <View key={idx} style={styles.tipRow}>
                  <Ionicons name="checkmark" size={14} color={TEAL} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                captureMode === "camera" && styles.modeButtonActive,
              ]}
              onPress={() => setCaptureMode("camera")}
              accessibilityRole="button"
              accessibilityState={{ selected: captureMode === "camera" }}
            >
              <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
              <Text style={styles.modeButtonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                captureMode === "upload" && styles.modeButtonActive,
              ]}
              onPress={() => setCaptureMode("upload")}
              accessibilityRole="button"
              accessibilityState={{ selected: captureMode === "upload" }}
            >
              <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
              <Text style={styles.modeButtonText}>Upload File</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action — gradient fade replicating the web version */}
      <LinearGradient
        colors={["transparent", NAVY]}
        locations={[0, 0.4]}
        style={styles.bottomBar}
        pointerEvents="box-none"
      >
        {captureMode === "camera" ? (
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleAction}
            accessibilityRole="button"
            accessibilityLabel={`Capture ${side}`}
          >
            <Ionicons name="ellipse-outline" size={22} color="#FFFFFF" />
            <Text style={styles.captureButtonText}>
              Capture {side === "front" ? "Front" : "Back"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleAction}
            accessibilityRole="button"
            accessibilityLabel="Choose file"
          >
            <Ionicons name="cloud-upload-outline" size={22} color="#FFFFFF" />
            <Text style={styles.uploadButtonText}>Choose File</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NAVY },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 140 },

  contentWrap: { paddingHorizontal: 20 },

  cameraPane: {
    backgroundColor: CAMERA_BG,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 20,
    position: "relative",
  },
  documentFrame: {
    width: "90%",
    height: "85%",
    borderWidth: 3,
    borderColor: "rgba(0,198,174,0.6)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  documentIconBox: {
    width: 80,
    height: 60,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  positionText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },

  // Corner markers — using 3px-wide L-shaped corners.
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
  },
  cornerTL: {
    top: 10,
    left: 10,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: TEAL,
  },
  cornerTR: {
    top: 10,
    right: 10,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: TEAL,
  },
  cornerBL: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: TEAL,
  },
  cornerBR: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: TEAL,
  },

  tipsCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  tipsList: { gap: 8 },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tipText: { fontSize: 12, color: "rgba(255,255,255,0.8)", flex: 1 },

  modeToggleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  modeButtonActive: {
    backgroundColor: TEAL,
  },
  modeButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: TEAL,
  },
  captureButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    borderStyle: "dashed",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
