// components/KYCGate.tsx — P0 of the KYC trigger review.
//
// Two surfaces, one truth source. Both read `user.kyc` from
// AuthContext (hydrated once per session, see AuthContext.fetchAndApplyKyc)
// so the gate decision is synchronous at button-press time — no
// network round trip stands between the user tapping Send and the
// app deciding whether to proceed.
//
// SURFACE 1: <KYCGate> component
//   Wraps an action UI. Passes children through when verified; renders
//   a blocking interstitial otherwise. Designed for cases where the
//   "Verify now" affordance can fully replace the action button (e.g.
//   the Send button at the bottom of DomesticSendMoneyScreen).
//
// SURFACE 2: useKYCGate() hook
//   Returns `ensureVerified(getResumeParams?)` — a no-op when the
//   user passes the gate, a side-effecting redirect otherwise.
//   Designed for async submit handlers where the screen wants to
//   short-circuit early in its own flow rather than swap out its
//   UI block.
//
// Both write the resume snapshot via lib/deferredAction and toast via
// the existing Alert helper. KYCHub's resume effect (P0.4) reads the
// snapshot back after a verified status flip and replays the navigate.
import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { setDeferredAction } from "../lib/deferredAction";

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  amber: "#D97706",
  amberBg: "#FEF3C7",
  white: "#FFFFFF",
  muted: "#6B7280",
  border: "#E5E7EB",
};

// P2 (kyc-trigger review): three-state block result so the gate can
// pick the right copy. "no_kyc" covers loading / never-started /
// rejected / expired — every state where the user hasn't reached
// the approved baseline. "tier_insufficient" specifically means
// "you ARE approved, but this action needs a higher tier" — the
// copy nudges the user to upgrade rather than start from scratch.
type BlockReason = "no_kyc" | "tier_insufficient" | null;

function blockReason(
  kyc: { status: string; tier: number } | null | undefined,
  requiredTier: number,
): BlockReason {
  if (!kyc) return "no_kyc";
  if (kyc.status !== "approved") return "no_kyc";
  if (kyc.tier < requiredTier) return "tier_insufficient";
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// SURFACE 2 — useKYCGate hook (defined first; the component uses it).
// ─────────────────────────────────────────────────────────────────────

export function useKYCGate(opts: {
  // Route to resume after the gate clears. Must match a registered
  // screen name on the root navigator — KYCHub will navigate(route,
  // params) at the end of its success effect.
  resumeRoute: string;
  // Minimum tier the action requires. Defaults to 0 — any "approved"
  // status is enough. Tier > 0 enforces additional KYC layers (e.g.
  // tax ID, address proof) and will block users sitting at a lower
  // tier even when their base status is "approved".
  requiredTier?: number;
}) {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const requiredTier = opts.requiredTier ?? 0;
  const reason = blockReason(user?.kyc, requiredTier);
  const blocked = reason !== null;

  // The async signature is deliberate so callers can `await` the
  // helper — the AsyncStorage write must land before we navigate or
  // the resume site could read stale state.
  const ensureVerified = useCallback(
    async (getResumeParams?: () => unknown): Promise<boolean> => {
      const r = blockReason(user?.kyc, requiredTier);
      if (r === null) return true;
      const params = getResumeParams ? getResumeParams() : undefined;
      await setDeferredAction({ route: opts.resumeRoute, params });
      // P2 — tier-insufficient gets the upgrade-prompt copy; everything
      // else gets the original "verify first" copy.
      const titleKey =
        r === "tier_insufficient"
          ? "kyc_gate.tier_upgrade_title"
          : "kyc_gate.title";
      const bodyKey =
        r === "tier_insufficient"
          ? "kyc_gate.tier_upgrade_body"
          : "kyc_gate.toast_saved";
      Alert.alert(t(titleKey), t(bodyKey));
      navigation.navigate("KYCHub");
      return false;
    },
    [user?.kyc, requiredTier, opts.resumeRoute, navigation, t],
  );

  return { blocked, blockReason: reason, ensureVerified };
}

// ─────────────────────────────────────────────────────────────────────
// SURFACE 1 — <KYCGate> component
// ─────────────────────────────────────────────────────────────────────

type Props = {
  children: React.ReactNode;
  requiredTier?: number;
  // Route to resume after the gate clears.
  resumeRoute: string;
  // Called lazily when the user taps "Verify now" — the snapshot of
  // the parent's form/state to replay on resume. Use this to capture
  // the most recent state at gate-tap time rather than at gate-render
  // time (the gate may render long before the user taps).
  getResumeParams?: () => unknown;
  // Optional override of the blocking UI. When provided we render
  // this in place of the default card; useful when the action site
  // wants to embed the gate inline rather than as a centred card.
  fallback?: React.ReactNode;
};

export default function KYCGate({
  children,
  requiredTier = 0,
  resumeRoute,
  getResumeParams,
  fallback,
}: Props) {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const reason = blockReason(user?.kyc, requiredTier);
  if (reason === null) return <>{children}</>;

  // Pick the title/body pair by reason. Tier-insufficient is the new
  // P2 path — the user IS verified but this action needs a higher
  // tier, so we direct them to "upgrade verification" rather than
  // "start verifying", which reads better and keeps the trust
  // they've already built.
  const isTierIssue = reason === "tier_insufficient";
  const titleKey = isTierIssue ? "kyc_gate.tier_upgrade_title" : "kyc_gate.title";
  const bodyKey = isTierIssue ? "kyc_gate.tier_upgrade_body" : "kyc_gate.body";
  const buttonKey = isTierIssue
    ? "kyc_gate.tier_upgrade_button"
    : "kyc_gate.button";

  const handleVerify = async () => {
    const params = getResumeParams ? getResumeParams() : undefined;
    await setDeferredAction({ route: resumeRoute, params });
    Alert.alert(t(titleKey), t("kyc_gate.toast_saved"));
    navigation.navigate("KYCHub");
  };

  if (fallback) return <>{fallback}</>;

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons
          name={isTierIssue ? "arrow-up-circle-outline" : "shield-outline"}
          size={26}
          color={COLORS.amber}
        />
      </View>
      <Text style={styles.title}>{t(titleKey)}</Text>
      <Text style={styles.body}>{t(bodyKey)}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={handleVerify}
        accessibilityRole="button"
        accessibilityLabel={t(buttonKey)}
      >
        <Text style={styles.buttonText}>{t(buttonKey)}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
    padding: 18,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.amberBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.navy,
    marginBottom: 8,
    textAlign: "center",
  },
  body: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
  },
  button: {
    backgroundColor: COLORS.teal,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 12,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
