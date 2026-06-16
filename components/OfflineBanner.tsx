// components/OfflineBanner.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Global amber band rendered above the navigator when AuthContext reports
// isOffline. Tap "Retry" to force a connectivity probe + supabase.auth
// .refreshSession() round-trip; on success the banner self-dismisses.
//
// Mounted in App.tsx above the Stack.Navigator so it overlays every
// screen — including auth screens, where a no-connectivity hint is still
// useful even without a live session.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

const AMBER_BG = "#FEF3C7";
const AMBER_BORDER = "#FCD34D";
const TEXT = "#78350F";
const TEXT_SUB = "#92400E";

export default function OfflineBanner() {
  const { t } = useTranslation();
  const { isOffline, retryRefresh } = useAuth();
  const [retrying, setRetrying] = useState(false);

  if (!isOffline) return null;

  const onRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await retryRefresh();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.band} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={18} color={TEXT} />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {t("auth.offline_banner_title")}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {t("auth.offline_banner_body")}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.retryBtn, retrying && styles.retryBtnBusy]}
        onPress={onRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityState={{ busy: retrying }}
      >
        {retrying ? (
          <ActivityIndicator size="small" color={TEXT} />
        ) : (
          <Text style={styles.retryText}>
            {t("auth.offline_banner_retry")}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: AMBER_BG,
    borderBottomWidth: 1,
    borderBottomColor: AMBER_BORDER,
    paddingHorizontal: 14,
    // Bump down a hair on iOS so it doesn't ride directly under the
    // status bar — App.tsx sits it inside the safe-area-friendly tree
    // already, but the visual breathing room matters.
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: 10,
  },
  copy: { flex: 1 },
  title: { fontSize: 13, fontWeight: "700", color: TEXT },
  body: { fontSize: 11, color: TEXT_SUB, marginTop: 1 },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AMBER_BORDER,
    backgroundColor: "rgba(255,255,255,0.55)",
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  retryBtnBusy: { opacity: 0.7 },
  retryText: { fontSize: 12, fontWeight: "700", color: TEXT },
});
