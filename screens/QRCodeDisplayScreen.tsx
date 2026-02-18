import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  Dimensions,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";

// Try to import QRCode, but gracefully handle if it fails
let QRCode: any = null;
try {
  QRCode = require("react-native-qrcode-svg").default;
} catch (e) {
  console.log("QRCode library not available, using fallback");
}

type QRCodeDisplayNavigationProp = StackNavigationProp<RootStackParamList>;
type QRCodeDisplayRouteProp = RouteProp<RootStackParamList, "QRCodeDisplay">;

const { width } = Dimensions.get("window");
const QR_SIZE = width * 0.6;

// Simple fallback QR placeholder component
const QRPlaceholder = ({ code, size }: { code: string; size: number }) => {
  // Create a simple visual pattern based on the code
  const gridSize = 11;
  const cellSize = size / gridSize;

  // Generate a deterministic pattern from the code
  const generatePattern = () => {
    const pattern: boolean[][] = [];
    for (let i = 0; i < gridSize; i++) {
      pattern[i] = [];
      for (let j = 0; j < gridSize; j++) {
        // Always have borders
        if (i === 0 || i === gridSize - 1 || j === 0 || j === gridSize - 1) {
          pattern[i][j] = true;
        } else if (i < 3 && j < 3) {
          // Top-left finder pattern
          pattern[i][j] = true;
        } else if (i < 3 && j > gridSize - 4) {
          // Top-right finder pattern
          pattern[i][j] = true;
        } else if (i > gridSize - 4 && j < 3) {
          // Bottom-left finder pattern
          pattern[i][j] = true;
        } else {
          // Data pattern based on code characters
          const charIndex = (i + j) % code.length;
          const charCode = code.charCodeAt(charIndex);
          pattern[i][j] = (charCode + i * j) % 3 === 0;
        }
      }
    }
    return pattern;
  };

  const pattern = generatePattern();

  return (
    <View style={{ width: size, height: size, backgroundColor: "#FFFFFF", padding: 8 }}>
      {pattern.map((row, i) => (
        <View key={i} style={{ flexDirection: "row" }}>
          {row.map((cell, j) => (
            <View
              key={j}
              style={{
                width: cellSize - 2,
                height: cellSize - 2,
                backgroundColor: cell ? "#0A2342" : "#FFFFFF",
                margin: 1,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

export default function QRCodeDisplayScreen() {
  const navigation = useNavigation<QRCodeDisplayNavigationProp>();
  const route = useRoute<QRCodeDisplayRouteProp>();
  const { circleId } = route.params;
  const { circles, browseCircles, generateInviteCode } = useCircles();

  // Find the circle
  const circle = [...circles, ...browseCircles].find((c) => c.id === circleId);

  if (!circle) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Circle Not Found</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" />
          <Text style={styles.errorText}>This circle could not be found.</Text>
        </View>
      </View>
    );
  }

  // Generate invite code
  const inviteCode = generateInviteCode(circle);

  // Create the full invite link for the QR code
  const inviteLink = `tandaxn://join/${inviteCode}`;

  // Copy invite code to clipboard
  const handleCopyCode = async () => {
    try {
      const Clipboard = require("react-native").Clipboard;
      await Clipboard.setString(inviteCode);
      Alert.alert("Copied!", "Invite code copied to clipboard", [{ text: "OK" }]);
    } catch (error) {
      console.error("Error copying:", error);
    }
  };

  // Share invite via native share
  const handleShare = async () => {
    try {
      await Share.share({
        message:
          `Join my TandaXn savings circle "${circle.name}"!\n\n` +
          `Use invite code: ${inviteCode}\n\n` +
          `Contribution: $${circle.amount} ${circle.frequency}\n` +
          `Members: ${circle.currentMembers}/${circle.memberCount}\n\n` +
          `Download TandaXn: https://tandaxn.app`,
        title: `Join ${circle.name} on TandaXn`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Invite to Circle</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Circle Info */}
          <View style={styles.circleInfo}>
            <View style={styles.circleEmoji}>
              <Text style={styles.emojiText}>{circle.emoji}</Text>
            </View>
            <Text style={styles.circleName}>{circle.name}</Text>
            <Text style={styles.circleDetails}>
              ${circle.amount} {circle.frequency} | {circle.currentMembers}/{circle.memberCount}{" "}
              members
            </Text>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* QR Code Card */}
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Scan to Join</Text>
            <Text style={styles.qrSubtitle}>
              Have friends scan this QR code with the TandaXn app
            </Text>

            <View style={styles.qrContainer}>
              <View style={styles.qrWrapper}>
                {QRCode ? (
                  <QRCode
                    value={inviteLink}
                    size={QR_SIZE}
                    color="#0A2342"
                    backgroundColor="#FFFFFF"
                  />
                ) : (
                  <QRPlaceholder code={inviteCode} size={QR_SIZE} />
                )}
              </View>
            </View>

            {/* Invite Code Display */}
            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>Invite Code</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{inviteCode}</Text>
                <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
                  <Ionicons name="copy-outline" size={20} color="#00C6AE" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* How to Join Instructions */}
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>How to Join</Text>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Download TandaXn</Text>
                <Text style={styles.stepText}>Get the app from App Store or Play Store</Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Scan QR Code or Enter Code</Text>
                <Text style={styles.stepText}>
                  Open the app and tap "Join Circle" then scan or enter the code
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Confirm & Join</Text>
                <Text style={styles.stepText}>Review circle details and join the circle</Text>
              </View>
            </View>
          </View>

          {/* Alternative: Text Code */}
          <View style={styles.alternativeCard}>
            <Ionicons name="chatbubble-outline" size={24} color="#6366F1" />
            <View style={styles.alternativeContent}>
              <Text style={styles.alternativeTitle}>Can't scan?</Text>
              <Text style={styles.alternativeText}>
                Share the invite code "{inviteCode}" directly via message
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Share Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
          <Text style={styles.shareButtonText}>Share Invite</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
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
    alignItems: "center",
  },
  circleEmoji: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emojiText: {
    fontSize: 32,
  },
  circleName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  circleDetails: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
    textAlign: "center",
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  qrCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  qrSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#00C6AE",
  },
  codeContainer: {
    width: "100%",
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
    textAlign: "center",
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  codeText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
    letterSpacing: 2,
  },
  copyButton: {
    padding: 8,
    backgroundColor: "rgba(0, 198, 174, 0.1)",
    borderRadius: 8,
  },
  instructionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 16,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
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
  alternativeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  alternativeContent: {
    flex: 1,
  },
  alternativeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  alternativeText: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
