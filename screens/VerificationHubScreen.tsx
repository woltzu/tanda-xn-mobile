// ══════════════════════════════════════════════════════════════════════════════
// screens/VerificationHubScreen.tsx — KYC-010 verification status hub
// ══════════════════════════════════════════════════════════════════════════════
//
// Central status screen showing where the user stands in the
// verification journey: which tier they're at, which 4 steps are
// complete / pending / not started, any blocking conditions
// (pending payout, ITIN in flight), and the next action.
//
// Route params (all optional — Phase KYC-2 will source the real values
// from a KYC context):
//
//   {
//     currentTier?: 1 | 2 | 3;
//     verificationStatus?: {
//       email?: 'completed' | 'pending' | 'in_progress' | 'not_started';
//       phone?: 'completed' | 'pending' | 'in_progress' | 'not_started';
//       identity?: 'completed' | 'pending' | 'in_progress' | 'not_started';
//       taxId?: 'completed' | 'pending' | 'in_progress' | 'not_started';
//     };
//     itinStatus?: 'pending' | 'approved' | null;
//     pendingPayout?: { amount: number; circleName: string };
//   }
//
// For Phase KYC-1 we fall back to:
//   tier 1, email+phone NOT started (no real auth check yet), no ITIN
//   in flight, no pending payout.
//
// Step actions:
//   - identity  → IDVerificationStart
//   - taxId     → TaxIDEntry
//   - email/phone — currently no-op (those flows live in the auth
//                   sign-up, not in KYC). Tapping a not-completed
//                   email/phone step shows an Alert telling the user
//                   to confirm via the link/SMS they were sent.
//
// "Learn About ITIN" CTA → ITINEducation.
// Back button → Dashboard (this hub is meant to be a destination from
// the main app, not an upstream KYC step).
//
// Translated from KYC screens/10_VerificationHub.jsx.
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type StepStatus = "completed" | "pending" | "in_progress" | "not_started";

type VerificationStatus = {
  email?: StepStatus;
  phone?: StepStatus;
  identity?: StepStatus;
  taxId?: StepStatus;
};

type VerificationHubParams = {
  currentTier?: 1 | 2 | 3;
  verificationStatus?: VerificationStatus;
  itinStatus?: "pending" | "approved" | null;
  pendingPayout?: { amount: number; circleName: string };
};
type VerificationHubRouteProp = RouteProp<
  { VerificationHub: VerificationHubParams },
  "VerificationHub"
>;

type StepId = "email" | "phone" | "identity" | "taxId";
type StepConfig = {
  id: StepId;
  icon: string;
  titleKey: string;
  descKey: string;
  tier: 1 | 2 | 3;
  optional?: boolean;
};

// i18n: titleKey/descKey resolved per-render via t() at call site.
const STEPS: StepConfig[] = [
  {
    id: "email",
    icon: "📧",
    titleKey: "verification_hub.step_email_title",
    descKey: "verification_hub.step_email_desc",
    tier: 1,
  },
  {
    id: "phone",
    icon: "📱",
    titleKey: "verification_hub.step_phone_title",
    descKey: "verification_hub.step_phone_desc",
    tier: 1,
  },
  {
    id: "identity",
    icon: "🪪",
    titleKey: "verification_hub.step_identity_title",
    descKey: "verification_hub.step_identity_desc",
    tier: 2,
  },
  {
    id: "taxId",
    icon: "📋",
    titleKey: "verification_hub.step_tax_title",
    descKey: "verification_hub.step_tax_desc",
    tier: 3,
    optional: true,
  },
];

function statusColor(status: StepStatus): string {
  switch (status) {
    case "completed":
      return "#059669";
    case "pending":
      return "#D97706";
    case "in_progress":
      return "#3B82F6";
    case "not_started":
    default:
      return "#9CA3AF";
  }
}

function statusLabelKey(status: StepStatus): string {
  switch (status) {
    case "completed":
      return "verification_hub.status_complete";
    case "pending":
      return "verification_hub.status_pending";
    case "in_progress":
      return "verification_hub.status_in_progress";
    case "not_started":
    default:
      return "verification_hub.status_not_started";
  }
}

function statusIcon(
  status: StepStatus,
): "checkmark" | "time-outline" | "ellipse-outline" {
  switch (status) {
    case "completed":
      return "checkmark";
    case "pending":
    case "in_progress":
      return "time-outline";
    case "not_started":
    default:
      return "ellipse-outline";
  }
}

function tierNameKey(tier: 1 | 2 | 3): string {
  return tier === 1
    ? "verification_hub.tier_name_basic"
    : tier === 2
      ? "verification_hub.tier_name_verified"
      : "verification_hub.tier_name_full";
}

function tierEmoji(tier: 1 | 2 | 3): string {
  return tier === 1 ? "🌱" : tier === 2 ? "✨" : "🏆";
}

export default function VerificationHubScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<VerificationHubRouteProp>();
  const { t } = useTranslation();
  const params = route.params ?? {};
  const currentTier = params.currentTier ?? 1;
  const verificationStatus: Required<VerificationStatus> = {
    email: params.verificationStatus?.email ?? "not_started",
    phone: params.verificationStatus?.phone ?? "not_started",
    identity: params.verificationStatus?.identity ?? "not_started",
    taxId: params.verificationStatus?.taxId ?? "not_started",
  };
  const itinStatus = params.itinStatus ?? null;
  const pendingPayout = params.pendingPayout ?? null;

  const handleStartStep = (stepId: StepId) => {
    switch (stepId) {
      case "identity":
        navigation.navigate(Routes.IDVerificationStart);
        break;
      case "taxId":
        navigation.navigate(Routes.TaxIDEntry);
        break;
      case "email":
        Alert.alert(
          t("verification_hub.alert_email_title"),
          t("verification_hub.alert_email_body"),
        );
        break;
      case "phone":
        Alert.alert(
          t("verification_hub.alert_phone_title"),
          t("verification_hub.alert_phone_body"),
        );
        break;
    }
  };

  const handleBack = () => {
    // The hub can be reached either from upstream KYC flow (back is
    // valid) or as a deep-link landing target (no history). React
    // Navigation's goBack() is a safe no-op in the latter case, but
    // we prefer routing to Dashboard so the user has somewhere to
    // land. canGoBack() is the standard React Navigation API for
    // detecting available history.
    const raw = navigation.raw as { canGoBack?: () => boolean };
    if (raw.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.navigate(Routes.Dashboard);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("verification_hub.header")}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Current tier card */}
          <View style={styles.tierCard}>
            <View>
              <Text style={styles.tierCardLabel}>{t("verification_hub.tier_label")}</Text>
              <Text style={styles.tierCardName}>
                {t("verification_hub.tier_display", { tier: currentTier, name: t(tierNameKey(currentTier)) })}
              </Text>
            </View>
            <View style={styles.tierEmojiBox}>
              <Text style={styles.tierEmoji}>{tierEmoji(currentTier)}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Pending payout alert */}
          {pendingPayout && currentTier < 3 && (
            <View style={styles.payoutAlert}>
              <View style={styles.payoutIcon}>
                <Text style={styles.payoutEmoji}>💰</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payoutTitle}>
                  {t("verification_hub.payout_title", { amount: pendingPayout.amount.toLocaleString() })}
                </Text>
                <Text style={styles.payoutBody}>
                  {t("verification_hub.payout_body_prefix")}{pendingPayout.circleName}
                </Text>
              </View>
            </View>
          )}

          {/* ITIN pending status */}
          {itinStatus === "pending" && (
            <View style={styles.itinPendingAlert}>
              <View style={styles.itinPendingIcon}>
                <Ionicons name="time-outline" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itinPendingTitle}>
                  {t("verification_hub.itin_pending_title")}
                </Text>
                <Text style={styles.itinPendingBody}>
                  {t("verification_hub.itin_pending_body")}
                </Text>
              </View>
            </View>
          )}

          {/* Verification steps */}
          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>{t("verification_hub.section_steps")}</Text>
            <View>
              {STEPS.map((step, idx) => {
                const status = verificationStatus[step.id];
                const isCompleted = status === "completed";
                const color = statusColor(status);
                return (
                  <View key={step.id}>
                    <TouchableOpacity
                      style={[
                        styles.stepRow,
                        {
                          backgroundColor: isCompleted ? "#F0FDFB" : "#F5F7FA",
                        },
                      ]}
                      onPress={() => {
                        if (!isCompleted) handleStartStep(step.id);
                      }}
                      disabled={isCompleted}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isCompleted }}
                      accessibilityLabel={`${t(step.titleKey)}, ${t(statusLabelKey(status))}`}
                    >
                      {/* Status circle */}
                      <View
                        style={[styles.stepStatusBox, { backgroundColor: color }]}
                      >
                        <Ionicons
                          name={statusIcon(status)}
                          size={20}
                          color="#FFFFFF"
                        />
                      </View>

                      {/* Content */}
                      <View style={{ flex: 1 }}>
                        <View style={styles.stepHeaderRow}>
                          <Text style={styles.stepEmoji}>{step.icon}</Text>
                          <Text style={styles.stepTitle}>{t(step.titleKey)}</Text>
                          {step.optional && (
                            <View style={styles.optionalChip}>
                              <Text style={styles.optionalChipText}>
                                {t("verification_hub.optional_chip")}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.stepDesc}>{t(step.descKey)}</Text>
                      </View>

                      {/* Status badge */}
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: `${color}15` },
                        ]}
                      >
                        <Text
                          style={[styles.statusBadgeText, { color }]}
                        >
                          {t(statusLabelKey(status))}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Connector line */}
                    {idx < STEPS.length - 1 && (
                      <View style={styles.connectorWrap}>
                        <View style={styles.connectorLine} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* ITIN help */}
          {verificationStatus.taxId !== "completed" && (
            <View style={styles.itinHelpCard}>
              <View style={styles.itinHelpHeader}>
                <Text style={styles.itinHelpEmoji}>💡</Text>
                <View>
                  <Text style={styles.itinHelpTitle}>{t("verification_hub.itin_help_title")}</Text>
                  <Text style={styles.itinHelpBody}>
                    {t("verification_hub.itin_help_body")}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.itinHelpButton}
                onPress={() => navigation.navigate(Routes.ITINEducation)}
                accessibilityRole="button"
                accessibilityLabel="Learn about ITIN"
              >
                <Text style={styles.itinHelpButtonText}>{t("verification_hub.btn_learn_itin")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
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
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  tierCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 16,
  },
  tierCardLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  tierCardName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },
  tierEmojiBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  tierEmoji: { fontSize: 24 },

  contentWrap: { padding: 20 },

  payoutAlert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  payoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#D97706",
    alignItems: "center",
    justifyContent: "center",
  },
  payoutEmoji: { fontSize: 20 },
  payoutTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
  },
  payoutBody: {
    fontSize: 12,
    color: "#B45309",
    marginTop: 4,
  },

  itinPendingAlert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  itinPendingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  itinPendingTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
  },
  itinPendingBody: {
    fontSize: 12,
    color: "#3B82F6",
    lineHeight: 18,
    marginTop: 4,
  },

  stepsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  stepsTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  stepStatusBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stepHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  stepEmoji: { fontSize: 16 },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
  },
  optionalChip: {
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  optionalChipText: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "600",
  },
  stepDesc: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  connectorWrap: {
    paddingLeft: 12 + 36 / 2, // align with center of status box
    paddingTop: 0,
  },
  connectorLine: {
    width: 2,
    height: 12,
    backgroundColor: "#E5E7EB",
  },

  itinHelpCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  itinHelpHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  itinHelpEmoji: { fontSize: 24 },
  itinHelpTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
  },
  itinHelpBody: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  itinHelpButton: {
    paddingVertical: 12,
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    alignItems: "center",
  },
  itinHelpButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
  },
});
