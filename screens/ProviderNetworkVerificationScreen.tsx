// ══════════════════════════════════════════════════════════════════════════════
// ProviderNetworkVerificationScreen — graduated verification upgrade flow
// ══════════════════════════════════════════════════════════════════════════════
// Phase 1C. Shows the provider's current verification level (1/2/3) with a
// horizontal progress indicator and one card per level. Each card lists the
// required steps and their statuses. For the next level, the action button
// either starts the missing step (document_upload → in_progress, site_visit
// → pending) or notes that the step is already in flight.
//
// The Phase 1A trigger created the elder_endorsement step at apply time;
// the Phase 1C trigger (migration 195) maintains providers.verification_
// level + verification_status based on completed steps and fan-outs
// notifications to admins on step request and to the provider on step
// completion / rejection / level upgrade.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  ProviderVerificationStep,
  useProviderDashboard,
} from "../hooks/useProviders";

type StepType = "elder_endorsement" | "document_upload" | "admin_site_visit";

const LEVEL_REQUIREMENTS: { level: 1 | 2 | 3; steps: StepType[] }[] = [
  { level: 1, steps: ["elder_endorsement"] },
  { level: 2, steps: ["elder_endorsement", "document_upload"] },
  { level: 3, steps: ["elder_endorsement", "document_upload", "admin_site_visit"] },
];

function levelLabel(t: any, level: number): string {
  switch (level) {
    case 3:
      return t("provider_list.level_premium");
    case 2:
      return t("provider_list.level_standard");
    default:
      return t("provider_list.level_basic");
  }
}

function levelColor(level: number): string {
  switch (level) {
    case 3:
      return "#7C3AED";
    case 2:
      return "#059669";
    default:
      return "#00C6AE";
  }
}

function stepStatusFor(
  steps: ProviderVerificationStep[],
  type: StepType,
): ProviderVerificationStep["status"] | "missing" {
  const s = steps.find((x) => x.step_type === type);
  if (!s) return "missing";
  return s.status;
}

function levelReached(
  steps: ProviderVerificationStep[],
  level: 1 | 2 | 3,
): boolean {
  const required = LEVEL_REQUIREMENTS.find((l) => l.level === level)!.steps;
  return required.every((step) => stepStatusFor(steps, step) === "completed");
}

export default function ProviderNetworkVerificationScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { provider, steps, loading, startVerificationStep } = useProviderDashboard();
  const [busyStep, setBusyStep] = useState<StepType | null>(null);

  const handleStart = async (type: "document_upload" | "admin_site_visit") => {
    setBusyStep(type);
    const result = await startVerificationStep(type);
    setBusyStep(null);
    if (!result.ok) {
      Alert.alert(
        t("provider_verification.error_title"),
        result.message ?? t("provider_verification.error_body"),
      );
    } else {
      Alert.alert(
        t("provider_verification.requested_title"),
        type === "document_upload"
          ? t("provider_verification.requested_docs")
          : t("provider_verification.requested_visit"),
      );
    }
  };

  if (loading && !provider) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#00C6AE" />
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={styles.container}>
        <Header onBack={() => navigation.goBack()} title={t("provider_verification.title")} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color="#9CA3AF" />
          <Text style={styles.emptyText}>{t("provider_dashboard.no_provider")}</Text>
        </View>
      </View>
    );
  }

  const currentLevel = provider.verification_level;
  const fullyVerified = levelReached(steps, 3);

  return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} title={t("provider_verification.title")} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Current level summary */}
        <View style={styles.headerCard}>
          <Text style={styles.headerKicker}>
            {t("provider_verification.current_level")}
          </Text>
          <Text style={styles.headerLevel}>
            {t("provider_verification.level_n", { level: currentLevel })} ·{" "}
            {levelLabel(t, currentLevel)}
          </Text>

          {/* Horizontal progression strip */}
          <View style={styles.progressionRow}>
            {([1, 2, 3] as const).map((n, idx) => {
              const reached = levelReached(steps, n);
              const color = reached ? levelColor(n) : "#E5E7EB";
              return (
                <React.Fragment key={n}>
                  <View
                    style={[
                      styles.progressDot,
                      { backgroundColor: color },
                    ]}
                  >
                    {reached ? (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    ) : (
                      <Text style={styles.progressDotText}>{n}</Text>
                    )}
                  </View>
                  {idx < 2 ? (
                    <View
                      style={[
                        styles.progressBar,
                        { backgroundColor: reached ? levelColor(n) : "#E5E7EB" },
                      ]}
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {fullyVerified ? (
          <View style={styles.successCard}>
            <Ionicons name="ribbon-outline" size={48} color="#059669" />
            <Text style={styles.successTitle}>
              {t("provider_verification.already_verified")}
            </Text>
          </View>
        ) : null}

        {/* Level cards */}
        {LEVEL_REQUIREMENTS.map(({ level, steps: req }) => {
          const reached = levelReached(steps, level);
          const isCurrent = level === currentLevel;
          const isNext = level === currentLevel + 1;
          return (
            <View key={level} style={styles.levelCard}>
              <View style={styles.levelHeaderRow}>
                <View
                  style={[
                    styles.levelBadge,
                    { backgroundColor: `${levelColor(level)}22` },
                  ]}
                >
                  <Text
                    style={[
                      styles.levelBadgeText,
                      { color: levelColor(level) },
                    ]}
                  >
                    {t("provider_verification.level_n", { level })} · {levelLabel(t, level)}
                  </Text>
                </View>
                {reached ? (
                  <Ionicons name="checkmark-circle" size={20} color="#059669" />
                ) : isCurrent ? (
                  <View style={styles.currentPill}>
                    <Text style={styles.currentPillText}>
                      {t("provider_verification.current_pill")}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.levelSubtitle}>
                {t("provider_verification.requirements_title")}
              </Text>

              {req.map((stepType) => {
                const status = stepStatusFor(steps, stepType);
                const tone =
                  status === "completed"
                    ? "#059669"
                    : status === "rejected"
                    ? "#EF4444"
                    : status === "in_progress"
                    ? "#F59E0B"
                    : "#6B7280";
                return (
                  <View key={stepType} style={styles.stepRow}>
                    <Ionicons
                      name={
                        stepType === "elder_endorsement"
                          ? "people-outline"
                          : stepType === "document_upload"
                          ? "document-text-outline"
                          : "shield-checkmark-outline"
                      }
                      size={18}
                      color={tone}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stepLabel}>
                        {t(`provider_verification.step_${stepType}`)}
                      </Text>
                      <Text style={[styles.stepStatusText, { color: tone }]}>
                        {t(
                          status === "missing"
                            ? "provider_verification.status_not_started"
                            : `provider_verification.status_${status}`,
                        )}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Action button — only on the NEXT level (the one the provider
                  can promote toward right now). */}
              {!reached && isNext ? (
                <ActionButton
                  level={level}
                  steps={steps}
                  busyStep={busyStep}
                  onStart={handleStart}
                />
              ) : null}
            </View>
          );
        })}

        <Text style={styles.footerNote}>
          {t("provider_verification.admin_review_note")}
        </Text>
      </ScrollView>
    </View>
  );
}

function ActionButton({
  level,
  steps,
  busyStep,
  onStart,
}: {
  level: 1 | 2 | 3;
  steps: ProviderVerificationStep[];
  busyStep: StepType | null;
  onStart: (type: "document_upload" | "admin_site_visit") => void;
}) {
  const { t } = useTranslation();
  // Pick the first un-completed required step beyond elder_endorsement —
  // elder is created at apply time, so the provider's actionable step
  // here is always document_upload or admin_site_visit.
  const required = LEVEL_REQUIREMENTS.find((l) => l.level === level)!.steps;
  const missing = required.find(
    (s) =>
      (s === "document_upload" || s === "admin_site_visit") &&
      stepStatusFor(steps, s) !== "completed",
  ) as "document_upload" | "admin_site_visit" | undefined;
  if (!missing) return null;
  const status = stepStatusFor(steps, missing);
  const busy = busyStep === missing;
  const inFlight = status === "in_progress" || status === "pending";

  if (inFlight) {
    return (
      <View style={[styles.inFlightPill]}>
        <Ionicons name="hourglass-outline" size={14} color="#92400E" />
        <Text style={styles.inFlightText}>
          {missing === "document_upload"
            ? t("provider_verification.docs_in_review")
            : t("provider_verification.visit_scheduling")}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.btn, styles.btnPrimary]}
      onPress={() => onStart(missing)}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Text style={styles.btnPrimaryText}>
          {missing === "document_upload"
            ? t("provider_verification.start_docs")
            : t("provider_verification.request_visit")}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 38 }} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyText: { fontSize: 14, color: "#6B7280" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },

  scrollContent: { padding: 16, paddingBottom: 40 },

  headerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerKicker: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  headerLevel: { fontSize: 18, fontWeight: "800", color: "#0A2342", marginTop: 4 },

  progressionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotText: { color: "#0A2342", fontSize: 12, fontWeight: "800" },
  progressBar: { width: 60, height: 3, marginHorizontal: 6 },

  successCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    alignItems: "center",
    gap: 6,
  },
  successTitle: { fontSize: 16, fontWeight: "800", color: "#059669", textAlign: "center" },

  levelCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  levelHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  levelBadgeText: { fontSize: 12, fontWeight: "700" },
  currentPill: {
    backgroundColor: "#0A2342",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  currentPillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  levelSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  stepLabel: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  stepStatusText: { fontSize: 12, marginTop: 2 },

  btn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  btnPrimary: { backgroundColor: "#00C6AE" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  inFlightPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 12,
  },
  inFlightText: { color: "#92400E", fontSize: 12, fontWeight: "700" },

  footerNote: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
    textAlign: "center",
  },
});
