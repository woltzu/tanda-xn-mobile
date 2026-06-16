// components/AuthProgressStrip.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared 3-step strip used by three related journeys:
//
//   flow="reset"  : ① Email → ② Link → ③ Password
//     ForgotPasswordScreen (step=1), AuthCallbackScreen (step=2),
//     ResetPasswordScreen (step=3).
//
//   flow="signup" : ① Account → ② Verify → ③ Welcome
//     SignupScreen (step=1), EmailVerificationScreen (step=2),
//     (future) SignupWelcomeScreen (step=3).
//
//   flow="kyc"    : ① Identity → ② Documents → ③ Review
//     KYCHubScreen renders the strip with the step inferred from the
//     live KYCStatus. Added in P1 of the KYC trigger review.
//
// Same shape across all three flows so the user sees one continuous
// progress signal. The dark `variant` exists because AuthCallback
// renders over a navy gradient — without it the gray inactive states
// blend into the bg.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

type Step = 1 | 2 | 3;
type Variant = "light" | "dark";
type Flow = "reset" | "signup" | "kyc";

const TEAL = "#00C6AE";
const NAVY = "#0A2342";

export default function AuthProgressStrip({
  step,
  variant = "light",
  flow = "reset",
}: {
  step: Step;
  variant?: Variant;
  flow?: Flow;
}) {
  const { t } = useTranslation();
  // The kyc flow reuses the existing `kyc_hub.progress_step_*`
  // single-word labels (Identity / Documents / Review) that the
  // legacy progress chip on KYCHub already ships. Avoids duplicating
  // copy for the same human-readable steps.
  const labelKeyBase =
    flow === "signup"
      ? "signup.progress_step_"
      : flow === "kyc"
        ? "kyc_hub.progress_step_"
        : "forgot_password.progress_step_";
  const labelKeys =
    flow === "kyc"
      ? [
          `${labelKeyBase}identity`,
          `${labelKeyBase}documents`,
          `${labelKeyBase}review`,
        ]
      : [`${labelKeyBase}1`, `${labelKeyBase}2`, `${labelKeyBase}3`];
  const labels = [t(labelKeys[0]), t(labelKeys[1]), t(labelKeys[2])];
  const isDark = variant === "dark";
  const inactiveBg = isDark ? "rgba(255,255,255,0.12)" : "#E5E7EB";
  const inactiveFg = isDark ? "rgba(255,255,255,0.6)" : "#9CA3AF";
  const labelFg = isDark ? "rgba(255,255,255,0.85)" : NAVY;
  const inactiveLabelFg = isDark ? "rgba(255,255,255,0.5)" : "#6B7280";
  const connectorBg = isDark ? "rgba(255,255,255,0.18)" : "#E5E7EB";

  return (
    <View style={styles.row} accessibilityRole="progressbar">
      {[1, 2, 3].map((n, idx) => {
        const isActive = n === step;
        const isComplete = n < step;
        const filled = isActive || isComplete;
        const bg = filled ? TEAL : inactiveBg;
        const fg = filled ? "#FFFFFF" : inactiveFg;
        return (
          <React.Fragment key={n}>
            <View style={styles.stepCol}>
              <View style={[styles.circle, { backgroundColor: bg }]}>
                {isComplete ? (
                  <Ionicons name="checkmark" size={14} color={fg} />
                ) : (
                  <Text style={[styles.circleNum, { color: fg }]}>{n}</Text>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: filled ? labelFg : inactiveLabelFg },
                  isActive && styles.labelActive,
                ]}
              >
                {labels[idx]}
              </Text>
            </View>
            {n < 3 ? (
              <View
                style={[
                  styles.connector,
                  // Connector before step N belongs to step N-1 → it's
                  // "complete" when the user is on step N or later.
                  { backgroundColor: n < step ? TEAL : connectorBg },
                ]}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  stepCol: {
    alignItems: "center",
    width: 72,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  circleNum: { fontSize: 12, fontWeight: "800" },
  label: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: "600",
  },
  labelActive: { fontWeight: "800" },
  connector: {
    flex: 1,
    height: 2,
    marginTop: 11, // align with circle centre
    marginHorizontal: 2,
  },
});
