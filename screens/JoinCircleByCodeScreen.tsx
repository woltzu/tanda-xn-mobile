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
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";

type JoinCircleByCodeNavigationProp = StackNavigationProp<RootStackParamList>;

export default function JoinCircleByCodeScreen() {
  const navigation = useNavigation<JoinCircleByCodeNavigationProp>();
  const { t } = useTranslation();
  const { browseCircles, findCircleByInviteCode, circles } = useCircles();

  const [inviteCode, setInviteCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract a clean code from various accepted input forms — bare codes,
  // ?code= URL params, tandaxn:// deep links, and txn.io short links.
  const extractCodeFromLink = (input: string): string => {
    const urlMatch = input.match(/[?&]code=([A-Z0-9]+)/i);
    if (urlMatch) return urlMatch[1].toUpperCase();

    const deepLinkMatch = input.match(/tandaxn:\/\/join\/([A-Z0-9]+)/i);
    if (deepLinkMatch) return deepLinkMatch[1].toUpperCase();

    const shortLinkMatch = input.match(/txn\.io\/([A-Z0-9]+)/i);
    if (shortLinkMatch) return shortLinkMatch[1].toUpperCase();

    return input.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  };

  // Exact-match lookup via the context function (which itself calls
  // Supabase with `.eq("invite_code", ...)` — no partial-prefix fallback,
  // so a typo can't accidentally land the user on the wrong circle). The
  // prior local-iteration fallback used a name-derived code generator
  // that no longer matches the server-generated 8-char codes anyway.
  const findCircleByCode = async (code: string): Promise<string | null> => {
    const found = await findCircleByInviteCode(code);
    return found?.id ?? null;
  };

  const handleJoinByCode = async () => {
    if (inviteCode.trim().length < 4) {
      setError(t("join_by_code.error_invalid_code"));
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const cleanCode = extractCodeFromLink(inviteCode.trim());
      const circleId = await findCircleByCode(cleanCode);

      if (circleId) {
        navigation.navigate("JoinCircleConfirm", { circleId });
      } else {
        // Exact match failed — no partial fallback. Surface the typed
        // error key so the user gets a localized "Invite code not found"
        // hint instead of an interpolated raw code.
        setError(t("join_by_code.error_invite_code_not_found"));
      }
    } catch (err) {
      console.error("Error finding circle:", err);
      setError(t("join_by_code.error_generic"));
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
        Alert.alert(t("join_by_code.alert_clipboard_empty_title"), t("join_by_code.alert_clipboard_empty_body"));
      }
    } catch (err) {
      console.error("Error pasting:", err);
      Alert.alert(t("join_by_code.alert_error_title"), t("join_by_code.alert_clipboard_error_body"));
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
            <Text style={styles.headerTitle}>{t("join_by_code.header_title")}</Text>
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
            <Text style={styles.inputLabel}>{t("join_by_code.label_invite_code")}</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder={t("join_by_code.placeholder_code")}
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
              <Text style={styles.qrTitle}>{t("join_by_code.qr_title")}</Text>
              <Text style={styles.qrSubtitle}>
                Scan a QR code to join instantly
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Example Codes for Testing */}
          <View style={styles.exampleSection}>
            <Text style={styles.exampleTitle}>{t("join_by_code.example_title")}</Text>
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
            <Text style={styles.infoTitle}>{t("join_by_code.info_title")}</Text>
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
            <Text style={styles.joinButtonText}>{t("join_by_code.btn_searching")}</Text>
          ) : (
            <>
              <Ionicons name="enter-outline" size={20} color="#FFFFFF" />
              <Text style={styles.joinButtonText}>{t("join_by_code.btn_find_circle")}</Text>
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
