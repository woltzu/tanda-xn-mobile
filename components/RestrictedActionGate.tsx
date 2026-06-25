// ═══════════════════════════════════════════════════════════════════════════
// components/RestrictedActionGate.tsx — Phase 2 Bucket B
// ═══════════════════════════════════════════════════════════════════════════
//
// Wrap any financial-action button to block critical-tier members. Renders
// children unchanged for normal users; replaces with a disabled-look pill
// + restricted message for critical-tier users.
//
// Usage:
//   <RestrictedActionGate>
//     <Button title="Contribute" onPress={handleContribute} />
//   </RestrictedActionGate>
//
// Or with the imperative helper for handlers that can't be wrapped:
//   const { isBlocked, showBlockedAlert } = useRestrictedAction();
//   onPress={() => { if (isBlocked) return showBlockedAlert(); doIt(); }}
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useResolutionStatus } from "../hooks/useResolutionStatus";

interface Props {
  children: React.ReactNode;
  /** Override label on the disabled pill. Defaults to i18n restricted_action_short. */
  label?: string;
}

const RestrictedActionGate: React.FC<Props> = ({ children, label }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { isCritical, isLoading } = useResolutionStatus(user?.id);

  // While loading, render children optimistically — the next render after
  // resolution will swap in the gate. This avoids flicker for the 99% of
  // users who are not restricted.
  if (isLoading || !isCritical) return <>{children}</>;

  return (
    <TouchableOpacity
      style={styles.gate}
      onPress={() => navigation.navigate("ResolutionCenter")}
      accessibilityRole="button"
    >
      <Ionicons name="lock-closed" size={16} color="#991B1B" />
      <Text style={styles.gateText} numberOfLines={2}>
        {label ?? t("resolution_center.restricted_action_short")}
      </Text>
    </TouchableOpacity>
  );
};

export default RestrictedActionGate;

/**
 * Imperative variant — call inside an onPress handler when you can't wrap
 * the button. Returns isBlocked + a helper to show the standard alert.
 * Example:
 *   const { isBlocked, showBlockedAlert } = useRestrictedAction();
 *   const onPress = () => {
 *     if (isBlocked) return showBlockedAlert();
 *     // ... proceed with the action
 *   };
 */
export function useRestrictedAction(): {
  isBlocked: boolean;
  isLoading: boolean;
  showBlockedAlert: () => void;
} {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { isCritical, isLoading } = useResolutionStatus(user?.id);

  const showBlockedAlert = () => {
    const title = t("resolution_center.restricted_action_title");
    const body = t("resolution_center.restricted_action_message");
    const goLabel = t("resolution_center.go_to_resolution");
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const ok = window.confirm(`${title}\n\n${body}`);
      if (ok) navigation.navigate("ResolutionCenter");
      return;
    }
    Alert.alert(title, body, [
      { text: t("common.cancel"), style: "cancel" },
      { text: goLabel, onPress: () => navigation.navigate("ResolutionCenter") },
    ]);
  };

  return { isBlocked: isCritical, isLoading, showBlockedAlert };
}

const styles = StyleSheet.create({
  gate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  gateText: {
    color: "#991B1B",
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
});
