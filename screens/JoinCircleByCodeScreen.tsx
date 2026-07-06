import React, { useEffect, useRef, useState } from "react";
import * as ExpoClipboard from "expo-clipboard";
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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { useCircles } from "../context/CirclesContext";
import { useEventTracker } from "../hooks/useEventTracker";

type JoinCircleByCodeNavigationProp = StackNavigationProp<RootStackParamList>;
type JoinCircleByCodeRouteProp = RouteProp<RootStackParamList, "JoinCircleByCode">;

export default function JoinCircleByCodeScreen() {
  const navigation = useNavigation<JoinCircleByCodeNavigationProp>();
  const route = useRoute<JoinCircleByCodeRouteProp>();
  const { t } = useTranslation();
  const { browseCircles, findCircleByInviteCode, circles } = useCircles();
  const { track } = useEventTracker();

  // Pre-fill from route param when navigated from a deep-link dispatcher
  // (QuickJoinScreen's authed-user redirect). Falls back to empty string.
  const initialCode = (route.params?.code ?? "").toUpperCase();
  const [inviteCode, setInviteCode] = useState(initialCode);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clipboard auto-peek: on first mount, if the input is empty and the
  // clipboard looks like an invite code, surface a chip the user can
  // tap to fill the input. Web rejects clipboard reads without a user
  // gesture — the catch swallows that so we don't error-log on those
  // browsers. The pattern is intentionally broader than the 8-char
  // server-generated codes (gen_invite_code, migration 141) so it
  // tolerates organizer-supplied vanity codes from legacy circles.
  const INVITE_CODE_PATTERN = /^[A-Z0-9]{4,12}$/;
  const peekedRef = useRef(false);
  const [clipboardCode, setClipboardCode] = useState<string | null>(null);
  useEffect(() => {
    if (peekedRef.current) return;
    peekedRef.current = true;
    if (initialCode) return;
    ExpoClipboard.getStringAsync()
      .then((raw) => {
        const candidate = (raw ?? "").trim().toUpperCase();
        if (INVITE_CODE_PATTERN.test(candidate)) {
          setClipboardCode(candidate);
        }
      })
      .catch(() => undefined);
    // mount-only — eslint can't see the ref guard
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptClipboardCode = () => {
    if (!clipboardCode) return;
    setInviteCode(clipboardCode);
    setError(null);
    setClipboardCode(null);
  };

  const dismissClipboardChip = () => setClipboardCode(null);

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

  // Exact-match lookup via the context function (which now routes through
  // the SECURITY DEFINER `resolve_circle_by_invite_code` RPC — migration
  // 286 — so it works for callers who aren't yet in the circle's community
  // and would otherwise be filtered out by the tightened SELECT RLS from
  // migration 255).
  const handleJoinByCode = async () => {
    if (inviteCode.trim().length < 4) {
      setError(t("join_by_code.error_invalid_code"));
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const cleanCode = extractCodeFromLink(inviteCode.trim());
      const found = await findCircleByInviteCode(cleanCode);

      if (found) {
        // Forward the resolved Circle as `initialCircle` so the confirm
        // screen doesn't have to re-fetch (which would fail anyway for
        // non-members under current circles RLS). Also pass the plain
        // `inviteCode` string — if the navigator drops `initialCircle`
        // (react-native-web URL serialization strips complex nested
        // params), the confirm screen can re-resolve from the code
        // alone via the SECURITY DEFINER RPC.
        navigation.navigate("JoinCircleConfirm", {
          circleId: found.id,
          source: "code",
          initialCircle: found,
          inviteCode: cleanCode,
        });
      } else {
        // Exact match failed — no partial fallback. Surface the typed
        // error key so the user gets a localized "Invite code not found"
        // hint instead of an interpolated raw code.
        setError(t("join_by_code.error_invite_code_not_found"));
        track({
          eventType: "join_circle_code_search_failed",
          eventCategory: "savings",
          eventAction: "code_search_failed",
          eventValue: { code: cleanCode },
        });
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
            {t("join_by_code.subtitle")}
          </Text>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Clipboard auto-peek chip — surfaced only when the input
              is empty AND the clipboard looks like a code. */}
          {clipboardCode && !inviteCode ? (
            <View style={styles.clipboardChipRow}>
              <TouchableOpacity
                style={styles.clipboardChip}
                onPress={acceptClipboardCode}
                accessibilityRole="button"
                accessibilityLabel={t("join_by_code.use_copied_code", { code: clipboardCode })}
              >
                <Ionicons name="clipboard" size={14} color="#00C6AE" />
                <Text style={styles.clipboardChipText}>
                  {t("join_by_code.use_copied_code", { code: clipboardCode })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={dismissClipboardChip}
                style={styles.clipboardChipDismiss}
                accessibilityRole="button"
              >
                <Ionicons name="close" size={14} color="#6B7280" />
              </TouchableOpacity>
            </View>
          ) : null}

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
                {t("join_by_code.qr_subtitle")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {/* How It Works */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{t("join_by_code.info_title")}</Text>
            <View style={styles.infoStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>{t("join_by_code.how_it_works_step_1")}</Text>
            </View>
            <View style={styles.infoStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>{t("join_by_code.how_it_works_step_2")}</Text>
            </View>
            <View style={styles.infoStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>{t("join_by_code.how_it_works_step_3")}</Text>
            </View>
          </View>

          {/* Browse Public Circles */}
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() =>
              // Drop the user onto the Circles tab specifically so the
              // browse list is the visible surface — earlier this just
              // routed to MainTabs (default tab = Home).
              navigation.navigate("MainTabs", {
                screen: "Circles",
              } as never)
            }
          >
            <Ionicons name="search-outline" size={18} color="#00C6AE" />
            <Text style={styles.browseButtonText}>
              {t("join_by_code.browse_fallback")}
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
  clipboardChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  clipboardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  clipboardChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  clipboardChipDismiss: {
    padding: 6,
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
