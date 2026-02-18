import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Vibration,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";

type QRScannerNavigationProp = StackNavigationProp<RootStackParamList>;

const { width, height } = Dimensions.get("window");
const SCAN_AREA_SIZE = width * 0.7;

export default function QRScannerScreen() {
  const navigation = useNavigation<QRScannerNavigationProp>();
  const { findCircleByInviteCode, circles, browseCircles } = useCircles();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  // Parse QR code data to extract invite code
  const parseQRData = (data: string): string | null => {
    // Handle TandaXn deep links: tandaxn://join/CODE
    const deepLinkMatch = data.match(/tandaxn:\/\/join\/([A-Z0-9]+)/i);
    if (deepLinkMatch) return deepLinkMatch[1].toUpperCase();

    // Handle web links: https://tandaxn.app/join?code=CODE
    const webLinkMatch = data.match(/[?&]code=([A-Z0-9]+)/i);
    if (webLinkMatch) return webLinkMatch[1].toUpperCase();

    // Handle short links: txn.io/CODE
    const shortLinkMatch = data.match(/txn\.io\/([A-Z0-9]+)/i);
    if (shortLinkMatch) return shortLinkMatch[1].toUpperCase();

    // Handle plain invite codes (alphanumeric, 6-14 characters)
    const plainCode = data.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (plainCode.length >= 6 && plainCode.length <= 14) {
      return plainCode;
    }

    return null;
  };

  // Find circle by invite code (async for database search)
  const findCircleByCode = async (code: string): Promise<string | null> => {
    // Check static demo codes first
    const staticCodes: Record<string, string> = {
      TANDA2024: "browse-1",
      FAMILY123: "browse-2",
      SAVE2025: "browse-3",
      GOAL100: "browse-4",
    };

    if (staticCodes[code]) {
      return staticCodes[code];
    }

    // Use context function to find circle (async - searches database)
    const foundCircle = await findCircleByInviteCode(code);
    if (foundCircle) {
      return foundCircle.id;
    }

    // Search local circles directly as fallback
    for (const circle of circles) {
      const inviteCode =
        circle.inviteCode ||
        circle.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10) +
          new Date(circle.createdAt).getFullYear();
      if (inviteCode === code) {
        return circle.id;
      }
    }

    return null;
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;

    setScanned(true);

    // Vibrate on successful scan
    if (Platform.OS !== "web") {
      Vibration.vibrate(100);
    }

    const inviteCode = parseQRData(data);

    if (inviteCode) {
      // Search for circle (async database search)
      const circleId = await findCircleByCode(inviteCode);

      if (circleId) {
        // Found a valid circle, navigate to confirm screen
        navigation.replace("JoinCircleConfirm", { circleId });
      } else {
        // Code parsed but no matching circle found
        Alert.alert(
          "Circle Not Found",
          `No circle found with code "${inviteCode}". The code may be expired or invalid.`,
          [
            {
              text: "Scan Again",
              onPress: () => setScanned(false),
            },
            {
              text: "Enter Manually",
              onPress: () => navigation.replace("JoinCircleByCode" as any),
            },
          ]
        );
      }
    } else {
      // Could not parse QR code
      Alert.alert(
        "Invalid QR Code",
        "This doesn't appear to be a TandaXn invite code. Please scan a valid circle invite QR code.",
        [
          {
            text: "Try Again",
            onPress: () => setScanned(false),
          },
          {
            text: "Cancel",
            onPress: () => navigation.goBack(),
            style: "cancel",
          },
        ]
      );
    }
  };

  if (!permission) {
    // Camera permissions are still loading
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="camera-outline" size={64} color="#00C6AE" />
          <Text style={styles.loadingText}>Loading camera...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera-outline" size={64} color="#00C6AE" />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            To scan QR codes, TandaXn needs access to your camera. Your camera is only used for scanning invite codes.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Ionicons name="camera" size={20} color="#FFFFFF" />
            <Text style={styles.permissionButtonText}>Enable Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => navigation.replace("JoinCircleByCode" as any)}
          >
            <Text style={styles.manualButtonText}>Enter Code Manually Instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={flashOn}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <TouchableOpacity style={styles.flashButton} onPress={() => setFlashOn(!flashOn)}>
            <Ionicons
              name={flashOn ? "flash" : "flash-outline"}
              size={24}
              color={flashOn ? "#F59E0B" : "#FFFFFF"}
            />
          </TouchableOpacity>
        </View>

        {/* Scan Area with Corners */}
        <View style={styles.scanAreaContainer}>
          <View style={styles.scanArea}>
            {/* Corner decorations */}
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />

            {/* Scan line animation placeholder */}
            <View style={styles.scanLine} />
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Position QR code within the frame</Text>
          <Text style={styles.instructionsText}>
            Scan a TandaXn circle invite QR code to join instantly
          </Text>

          {/* Manual entry option */}
          <TouchableOpacity
            style={styles.manualEntryButton}
            onPress={() => navigation.replace("JoinCircleByCode" as any)}
          >
            <Ionicons name="keypad-outline" size={20} color="#00C6AE" />
            <Text style={styles.manualEntryText}>Enter code manually</Text>
          </TouchableOpacity>
        </View>

        {/* Rescan button when scanned */}
        {scanned && (
          <TouchableOpacity style={styles.rescanButton} onPress={() => setScanned(false)}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.rescanButtonText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    backgroundColor: "#0A2342",
  },
  permissionIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0, 198, 174, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  permissionText: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  permissionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 10,
    width: "100%",
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  manualButton: {
    marginTop: 20,
    padding: 12,
  },
  manualButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  flashButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanAreaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    backgroundColor: "transparent",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#00C6AE",
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: "absolute",
    top: "50%",
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: "rgba(0, 198, 174, 0.5)",
  },
  instructionsContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 60,
    paddingTop: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  instructionsText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    marginBottom: 20,
  },
  manualEntryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 198, 174, 0.5)",
  },
  manualEntryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  rescanButton: {
    position: "absolute",
    bottom: 140,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: "#00C6AE",
    borderRadius: 12,
  },
  rescanButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
