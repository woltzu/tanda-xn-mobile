// components/FirstLaunchProgressStrip.tsx
// ─────────────────────────────────────────────────────────────────────────────
// First-launch progress strip rendered at the top of DashboardScreen.
// Reads the auto-derived progress from useOnboarding() (slim context,
// P0 of the first-launch review).
//
//   Pip 1 ── verify_email      (always done by the time the user hits
//                                the Dashboard via the SignupWelcome
//                                flow — defensively handled regardless)
//   Pip 2 ── join_circle       (myCircles.length > 0)
//   Pip 3 ── first_contribution (useHasContribution())
//
// Visibility: self-renders to null when isComplete is true so the
// consumer (DashboardScreen) doesn't need to gate the mount.
//
// Tap behaviour, by nextStep:
//   join_circle       → navigate to the Circles tab.
//   first_contribution → navigate to CircleDetail of myCircles[0].
//                       (The dependency: this branch is only reachable
//                        when join_circle is already done, so the
//                        circle exists.)
//   verify_email      → no-op. Edge case for the rare path where a
//                        user lands on the Dashboard without an
//                        email_confirmed_at (e.g. a magic-link signup
//                        whose confirmation lapsed). The strip is
//                        still informative; we don't push them
//                        anywhere intrusive.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useOnboarding, type FirstLaunchStep } from "../context/OnboardingContext";
import { useCircles } from "../context/CirclesContext";

const TEAL = "#00C6AE";
const NAVY = "#0A2342";
const PIP_INACTIVE = "#E5E7EB";
const PIP_INACTIVE_FG = "#9CA3AF";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const TEXT = "#111827";

const STEP_ORDER: FirstLaunchStep[] = [
  "verify_email",
  "join_circle",
  "first_contribution",
];

const STEP_LABEL_I18N: Record<FirstLaunchStep, string> = {
  verify_email: "first_launch.step_label_1",
  join_circle: "first_launch.step_label_2",
  first_contribution: "first_launch.step_label_3",
};

export default function FirstLaunchProgressStrip() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { firstLaunchProgress, isComplete, nextStep } = useOnboarding();
  const { myCircles } = useCircles();

  if (isComplete || nextStep === null) return null;

  const handlePress = () => {
    if (nextStep === "join_circle") {
      // Dashboard lives inside HomeStack → Home tab → tab navigator.
      // getParent() climbs to the tab navigator so .navigate("Circles")
      // switches tabs rather than pushing onto the home stack.
      const parent = navigation.getParent?.();
      if (parent) {
        parent.navigate("Circles");
      } else {
        navigation.navigate("Circles");
      }
      return;
    }
    if (nextStep === "first_contribution") {
      const target = myCircles?.[0]?.id;
      if (target) {
        navigation.navigate("CircleDetail", { circleId: target });
      } else {
        // Defensive: step 3 implies step 2 is done, but if myCircles
        // hasn't loaded yet, fall back to the Circles tab.
        const parent = navigation.getParent?.();
        if (parent) parent.navigate("Circles");
        else navigation.navigate("Circles");
      }
      return;
    }
    // verify_email — no actionable destination from here.
  };

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={t(STEP_LABEL_I18N[nextStep])}
    >
      <View style={styles.pipsRow}>
        {STEP_ORDER.map((step, idx) => {
          const isDone = firstLaunchProgress[step];
          const isActive = step === nextStep;
          let bg = PIP_INACTIVE;
          let fg: string = PIP_INACTIVE_FG;
          let showCheck = false;
          if (isDone) {
            bg = TEAL;
            fg = "#FFFFFF";
            showCheck = true;
          } else if (isActive) {
            bg = NAVY;
            fg = "#FFFFFF";
          }
          return (
            <React.Fragment key={step}>
              <View style={[styles.pip, { backgroundColor: bg }]}>
                {showCheck ? (
                  <Ionicons name="checkmark" size={12} color={fg} />
                ) : (
                  <Text style={[styles.pipNumber, { color: fg }]}>{idx + 1}</Text>
                )}
              </View>
              {idx < STEP_ORDER.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor: firstLaunchProgress[step]
                        ? TEAL
                        : PIP_INACTIVE,
                    },
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

      <View style={styles.labelCol}>
        <Text style={styles.label} numberOfLines={2}>
          {t(STEP_LABEL_I18N[nextStep])}
        </Text>
        <Text style={styles.cta}>{t("first_launch.tap_to_start")}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={MUTED} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pipsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pipNumber: { fontSize: 12, fontWeight: "800" },
  connector: {
    width: 12,
    height: 2,
    marginHorizontal: 2,
  },
  labelCol: { flex: 1 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT,
    lineHeight: 18,
  },
  cta: {
    fontSize: 11,
    color: TEAL,
    fontWeight: "700",
    marginTop: 2,
  },
});
