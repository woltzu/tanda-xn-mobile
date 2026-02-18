import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Clipboard,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";

type JoinCircleByCodeNavigationProp = StackNavigationProp<RootStackParamList>;

export default function JoinCircleByCodeScreen() {
  const navigation = useNavigation<JoinCircleByCodeNavigationProp>();
  const { browseCircles, findCircleByInviteCode, circles } = useCircles();

  const [inviteCode, setInviteCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulate extracting code from various link formats
  const extractCodeFromLink = (input: string): string => {
    // Handle full URL with code parameter
    const urlMatch = input.match(/[?&]code=([A-Z0-9]+)/i);
    if (urlMatch) return urlMatch[1].toUpperCase();

    // Handle deep link format: tandaxn://join/CODE
    const deepLinkMatch = input.match(/tandaxn:\/\/join\/([A-Z0-9]+)/i);
    if (deepLinkMatch) return deepLinkMatch[1].toUpperCase();

    // Handle short link format: txn.io/CODE
    const shortLinkMatch = input.match(/txn\.io\/([A-Z0-9]+)/i);
    if (shortLinkMatch) return shortLinkMatch[1].toUpperCase();

    // Just return the cleaned code
    return input.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  };

  // Generate invite code from circle (same logic as in CircleDetailScreen)
  const generateInviteCode = (circle: any): string => {
    return circle.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10) +
      new Date(circle.createdAt).getFullYear();
  };

  // Find circle by invite code - uses context function (async for database search)
  const findCircleByCode = async (code: string): Promise<string | null> => {
    // First check static demo codes
    const staticCodes: Record<string, string> = {
      "TANDA2024": "browse-1",
      "FAMILY123": "browse-2",
      "SAVE2025": "browse-3",
      "GOAL100": "browse-4",
    };

    if (staticCodes[code]) {
      return staticCodes[code];
    }

    // Use context function to find circle (async - searches database)
    const foundCircle = await findCircleByInviteCode(code);
    if (foundCircle) {
      return foundCircle.id;
    }

    // Also search local circles directly as fallback
    for (const circle of circles) {
      const inviteCode = generateInviteCode(circle);
      if (inviteCode === code || circle.inviteCode === code) {
        return circle.id;
      }
    }

    return null;
  };

  const handleJoinByCode = async () => {
    if (inviteCode.trim().length < 4) {
      setError("Please enter a valid invite code or link");
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const cleanCode = extractCodeFromLink(inviteCode.trim());

      // Search for circle in database
      const circleId = await findCircleByCode(cleanCode);

      if (circleId) {
        // Found a circle, navigate to confirm screen
        navigation.navigate("JoinCircleConfirm", { circleId });
      } else {
        // No circle found with this code
        setError(`No circle found with code "${cleanCode}". Please check the code and try again.`);
      }
    } catch (err) {
      console.error("Error finding circle:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getString();
      if (text && text.trim()) {
        setInviteCode(text.trim().toUpperCase());
        setError(null);
      } else {
        Alert.alert("Clipboard Empty", "No text found in clipboard. Copy an invite code first.");
      }
    } catch (err) {
      console.error("Error pasting:", err);
      Alert.alert("Error", "Could not access clipboard. Please paste manually.");
    }
  };

  const handleScanQRCode = () => {
    // Navigate to QR Scanner screen
    navigation.navigate("QRScanner" as any);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Join Circle</Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={styles.headerSubtitle}>
            Enter an invite code or paste a link to join a savings circle
          </Text>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Code Input Section */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Invite Code or Link</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter code (e.g., TANDA2024)"
                placeholderTextColor="#9CA3AF"
                value={inviteCode}
                onChangeText={(text) => {
                  setInviteCode(text);
                  setError(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.pasteButton}
                onPress={handlePasteFromClipboard}
              >
                <Ionicons name="clipboard-outline" size={20} color="#00C6AE" />
              </TouchableOpacity>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>

          {/* QR Code Option */}
          <TouchableOpacity style={styles.qrButton} onPress={handleScanQRCode}>
            <View style={styles.qrIconContainer}>
              <Ionicons name="qr-code" size={24} color="#00C6AE" />
            </View>
            <View style={styles.qrContent}>
              <Text style={styles.qrTitle}>Scan QR Code</Text>
              <Text style={styles.qrSubtitle}>
                Scan a QR code to join instantly
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Example Codes for Testing */}
          <View style={styles.exampleSection}>
            <Text style={styles.exampleTitle}>Try These Demo Codes</Text>
            <Text style={styles.exampleSubtitle}>
              For testing, use any of these invite codes:
            </Text>
            <View style={styles.codeChips}>
              {["TANDA2024", "FAMILY123", "SAVE2025", "GOAL100"].map((code) => (
                <TouchableOpacity
                  key={code}
                  style={styles.codeChip}
                  onPress={() => setInviteCode(code)}
                >
                  <Text style={styles.codeChipText}>{code}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* How It Works */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How to get an invite code?</Text>
            <View style={styles.infoStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>
                Ask a friend or family member who is already in a circle
              </Text>
            </View>
            <View style={styles.infoStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>
                They can share the invite code or link from the circle settings
              </Text>
            </View>
            <View style={styles.infoStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>
                Enter the code here or tap the link to join automatically
              </Text>
            </View>
          </View>

          {/* Browse Public Circles */}
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.navigate("MainTabs")}
          >
            <Ionicons name="search-outline" size={18} color="#00C6AE" />
            <Text style={styles.browseButtonText}>
              Or browse public circles instead
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.joinButton,
            (inviteCode.trim().length < 4 || isSearching) &&
              styles.joinButtonDisabled,
          ]}
          onPress={handleJoinByCode}
          disabled={inviteCode.trim().length < 4 || isSearching}
        >
          {isSearching ? (
            <Text style={styles.joinButtonText}>Searching...</Text>
          ) : (
            <>
              <Ionicons name="enter-outline" size={20} color="#FFFFFF" />
              <Text style={styles.joinButtonText}>Find Circle</Text>
            </>
          )}
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
    marginBottom: 16,
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
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 20,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: "#0A2342",
    letterSpacing: 1,
  },
  pasteButton: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: "#DC2626",
  },
  qrButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 14,
  },
  qrIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  qrContent: {
    flex: 1,
  },
  qrTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  qrSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  exampleSection: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
  },
  exampleSubtitle: {
    fontSize: 12,
    color: "#B45309",
    marginBottom: 12,
  },
  codeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  codeChip: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  codeChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#D97706",
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 14,
  },
  infoStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
  },
  browseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
  },
  browseButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
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
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  joinButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
