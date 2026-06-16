// components/DashboardTourOverlay.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Lightweight 3-step tour shown to a brand-new user on the Dashboard.
// Self-mounts as a Modal bottom sheet from inside, so the Dashboard
// just renders <DashboardTourOverlay /> unconditionally — this
// component decides whether to show.
//
// Gates:
//   1. `firstLaunchProgress.join_circle === false`  — only relevant
//      while the user still needs to join a circle.
//   2. AsyncStorage `@tandaxn_onboarding_dashboard_tour_seen_v1` is
//      empty — show only on first launch.
//
// No coordinate measurement, no complex coach-mark overlay. Three
// modal cards in sequence. Skip / Finish writes the seen flag and
// dismisses; the user never sees the tour again on this device.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useOnboarding } from "../context/OnboardingContext";

const TEAL = "#00C6AE";
const NAVY = "#0A2342";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

const TOUR_SEEN_KEY = "@tandaxn_onboarding_dashboard_tour_seen_v1";

type StepKey = "circles" | "create" | "contribute";

const STEPS: Array<{
  key: StepKey;
  emoji: string;
  titleKey: string;
  bodyKey: string;
}> = [
  {
    key: "circles",
    emoji: "🔄",
    titleKey: "dashboard_tour.step1_title",
    bodyKey: "dashboard_tour.step1_body",
  },
  {
    key: "create",
    emoji: "➕",
    titleKey: "dashboard_tour.step2_title",
    bodyKey: "dashboard_tour.step2_body",
  },
  {
    key: "contribute",
    emoji: "💸",
    titleKey: "dashboard_tour.step3_title",
    bodyKey: "dashboard_tour.step3_body",
  },
];

export default function DashboardTourOverlay() {
  const { t } = useTranslation();
  const { firstLaunchProgress, loading } = useOnboarding();
  const [phase, setPhase] = useState<
    "checking" | "visible" | "dismissed"
  >("checking");
  const [stepIdx, setStepIdx] = useState(0);

  // Resolve eligibility once the underlying onboarding signals settle.
  // We only want to show on first launch AND only while join_circle is
  // still false. A user who already joined a circle gets the strip
  // (P1) instead — they don't need the tour.
  useEffect(() => {
    let cancelled = false;
    if (loading) return; // wait for useHasContribution to resolve
    if (firstLaunchProgress.join_circle) {
      setPhase("dismissed");
      return;
    }
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(TOUR_SEEN_KEY);
        if (cancelled) return;
        setPhase(seen ? "dismissed" : "visible");
      } catch {
        if (!cancelled) setPhase("dismissed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, firstLaunchProgress.join_circle]);

  const dismiss = async () => {
    setPhase("dismissed");
    try {
      await AsyncStorage.setItem(TOUR_SEEN_KEY, "1");
    } catch {
      /* best-effort */
    }
  };

  const handleNext = () => {
    if (stepIdx >= STEPS.length - 1) {
      dismiss();
    } else {
      setStepIdx((i) => i + 1);
    }
  };

  if (phase === "checking") {
    // Nothing on screen during the (typically sub-second) probe.
    return null;
  }
  if (phase === "dismissed") return null;

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.progressDots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === stepIdx ? styles.dotActive : null,
                  i < stepIdx ? styles.dotDone : null,
                ]}
              />
            ))}
          </View>

          <Text style={styles.emoji}>{step.emoji}</Text>
          <Text style={styles.title}>{t(step.titleKey)}</Text>
          <Text style={styles.body}>{t(step.bodyKey)}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={dismiss}
              accessibilityRole="button"
            >
              <Text style={styles.skipText}>
                {t("dashboard_tour.skip")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={handleNext}
              accessibilityRole="button"
            >
              <Text style={styles.nextText}>
                {isLast
                  ? t("dashboard_tour.finish")
                  : t("dashboard_tour.next")}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: "center",
    marginBottom: 18,
  },
  progressDots: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "center",
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
  },
  dotActive: { backgroundColor: NAVY, width: 24 },
  dotDone: { backgroundColor: TEAL },
  emoji: { fontSize: 48, alignSelf: "center", marginBottom: 12 },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: NAVY,
    textAlign: "center",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  skipText: { fontSize: 14, color: MUTED, fontWeight: "700" },
  nextBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  nextText: { fontSize: 14, color: "#FFFFFF", fontWeight: "800" },
});
