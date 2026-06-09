// ══════════════════════════════════════════════════════════════════════════════
// screens/ITINPendingScreen.tsx — KYC-012 ITIN application status
// ══════════════════════════════════════════════════════════════════════════════
//
// Tracking screen for users who have applied for an ITIN and are
// waiting for IRS approval. Shows a 4-step timeline (Submitted →
// Documents Received → Under Review → ITIN Assigned), an "while you
// wait" feature list, FAQs, and a help-chat button.
//
// Route params (all optional; Phase KYC-2 will source real values
// from the user_verification table):
//   {
//     applicationDate?: string;      // "Dec 15, 2024"
//     estimatedCompletion?: string;  // "Feb 15 - Mar 1, 2025"
//     applicationMethod?: 'caa' | 'mail';  // defaults to 'caa'
//   }
//
// Per Phase KYC-1 spec, the FAQ section uses the collapsible pattern
// from ITINApplicationHelpScreen (the source 12_ITINPending.jsx had
// them static, but collapsible is the established UX in this flow).
//
// "Continue to TandaXn" → Dashboard.
//
// Translated from KYC screens/12_ITINPending.jsx.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
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
const GREEN = "#059669";
const BLUE = "#3B82F6";

type ApplicationMethod = "caa" | "mail";
type TimelineStatus = "completed" | "current" | "pending";

type ITINPendingParams = {
  applicationDate?: string;
  estimatedCompletion?: string;
  applicationMethod?: ApplicationMethod;
};
type ITINPendingRouteProp = RouteProp<
  { ITINPending: ITINPendingParams },
  "ITINPending"
>;

// i18n: qKey/aKey/textKey resolved per-render via t() at call site.
const FAQS = [
  { qKey: "itin_pending.faq_time_q", aKey: "itin_pending.faq_time_a" },
  { qKey: "itin_pending.faq_notify_q", aKey: "itin_pending.faq_notify_a" },
  { qKey: "itin_pending.faq_track_q", aKey: "itin_pending.faq_track_a" },
];

const WAIT_FEATURE_KEYS = [
  "itin_pending.wait_join",
  "itin_pending.wait_receive",
  "itin_pending.wait_reputation",
  "itin_pending.wait_create",
];

export default function ITINPendingScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<ITINPendingRouteProp>();
  const { t } = useTranslation();
  const applicationDate = route.params?.applicationDate ?? "—";
  const estimatedCompletion =
    route.params?.estimatedCompletion ?? t("itin_pending.default_estimated_completion");
  const applicationMethod: ApplicationMethod =
    route.params?.applicationMethod ?? "caa";

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const timeline: {
    step: number;
    title: string;
    desc: string;
    status: TimelineStatus;
  }[] = [
    {
      step: 1,
      title: t("itin_pending.step_1_title"),
      desc: applicationDate,
      status: "completed",
    },
    {
      step: 2,
      title: t("itin_pending.step_2_title"),
      desc:
        applicationMethod === "caa" ? t("itin_pending.step_2_desc_caa") : t("itin_pending.step_2_desc_mail"),
      status: "completed",
    },
    {
      step: 3,
      title: t("itin_pending.step_3_title"),
      desc: t("itin_pending.step_3_desc"),
      status: "current",
    },
    {
      step: 4,
      title: t("itin_pending.step_4_title"),
      desc: t("itin_pending.step_4_desc"),
      status: "pending",
    },
  ];

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
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("itin_pending.header")}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Status card */}
          <View style={styles.statusCard}>
            <View style={styles.statusIconBox}>
              <Ionicons name="time-outline" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.statusLabel}>{t("itin_pending.status_label")}</Text>
            <Text style={styles.statusValue}>{t("itin_pending.status_value")}</Text>
            <Text style={styles.statusEstimate}>
              {t("itin_pending.status_estimate_prefix")}{estimatedCompletion}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Interest-First reassurance (KYC-2.2). Reinforces that the
              user isn't losing money while waiting weeks for the IRS
              to process the ITIN — interest keeps accruing in the
              background and unlocks the moment ITIN is verified. */}
          <View style={styles.interestGrowingCard}>
            <Text style={styles.interestGrowingEmoji}>💰</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.interestGrowingTitle}>
                {t("itin_pending.interest_growing_title")}
              </Text>
              <Text style={styles.interestGrowingBody}>
                {t("itin_pending.interest_growing_body")}
              </Text>
            </View>
          </View>

          {/* Timeline */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("itin_pending.section_progress")}</Text>
            <View>
              {timeline.map((item, idx) => {
                const isLast = idx === timeline.length - 1;
                const circleColor =
                  item.status === "completed"
                    ? GREEN
                    : item.status === "current"
                      ? BLUE
                      : "#E5E7EB";
                const connectorColor =
                  item.status === "completed" ? GREEN : "#E5E7EB";

                return (
                  <View key={item.step}>
                    <View style={styles.timelineRow}>
                      {/* Status circle */}
                      <View
                        style={[
                          styles.timelineCircle,
                          { backgroundColor: circleColor },
                        ]}
                      >
                        {item.status === "completed" ? (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        ) : item.status === "current" ? (
                          <View style={styles.timelineCurrentDot} />
                        ) : (
                          <View style={styles.timelinePendingDot} />
                        )}
                      </View>

                      {/* Content */}
                      <View style={styles.timelineContent}>
                        <Text
                          style={[
                            styles.timelineTitle,
                            item.status === "pending" && {
                              color: "#9CA3AF",
                            },
                          ]}
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={[
                            styles.timelineDesc,
                            item.status === "pending" && {
                              color: "#D1D5DB",
                            },
                          ]}
                        >
                          {item.desc}
                        </Text>
                        {item.status === "current" && (
                          <View style={styles.inProgressChip}>
                            <Text style={styles.inProgressChipText}>
                              {t("itin_pending.in_progress_chip")}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Connector */}
                    {!isLast && (
                      <View
                        style={[
                          styles.timelineConnector,
                          { backgroundColor: connectorColor },
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* While you wait */}
          <View style={styles.waitCard}>
            <Text style={styles.waitTitle}>{t("itin_pending.wait_title")}</Text>
            <View style={styles.waitList}>
              {WAIT_FEATURE_KEYS.map((textKey, idx) => (
                <View key={idx} style={styles.waitRow}>
                  <Ionicons name="checkmark" size={14} color={GREEN} />
                  <Text style={styles.waitText}>{t(textKey)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* FAQs (collapsible) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("itin_pending.section_faqs")}</Text>
            <View style={styles.faqsList}>
              {FAQS.map((faq, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <View key={idx}>
                    <TouchableOpacity
                      style={[
                        styles.faqHeader,
                        isOpen && styles.faqHeaderOpen,
                      ]}
                      onPress={() =>
                        setExpandedFaq(isOpen ? null : idx)
                      }
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                    >
                      <Text style={styles.faqQuestion}>{t(faq.qKey)}</Text>
                      <Ionicons
                        name={isOpen ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={NAVY}
                      />
                    </TouchableOpacity>
                    {isOpen && (
                      <View style={styles.faqAnswerWrap}>
                        <Text style={styles.faqAnswer}>{t(faq.aKey)}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Need help */}
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => {
              // Help chat lives outside this stack; for now this opens
              // the existing HelpCenter screen, which is the closest
              // existing support surface. KYC-2 may wire it to the
              // live-chat widget if/when that ships.
              navigation.navigate(Routes.HelpCenter);
            }}
            accessibilityRole="button"
            accessibilityLabel="Need help, chat with us"
          >
            <Text style={styles.helpEmoji}>💬</Text>
            <Text style={styles.helpText}>{t("itin_pending.help_text")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate(Routes.Dashboard)}
          accessibilityRole="button"
          accessibilityLabel="Continue to TandaXn"
        >
          <Text style={styles.primaryButtonText}>{t("itin_pending.btn_continue")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

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

  statusCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  statusIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 22,
    fontWeight: "700",
    color: TEAL,
    marginBottom: 8,
  },
  statusEstimate: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },

  contentWrap: { padding: 20 },

  // KYC-2.2 — Interest-still-growing reassurance card. Green palette
  // mirrors the InterestUnlockedSuccess celebration to signal "this
  // is about your money."
  interestGrowingCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  interestGrowingEmoji: { fontSize: 22 },
  interestGrowingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#065F46",
  },
  interestGrowingBody: {
    fontSize: 12,
    color: "#047857",
    lineHeight: 18,
    marginTop: 4,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 16,
  },

  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  timelineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineCurrentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
  },
  timelinePendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9CA3AF",
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 4,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
  },
  timelineDesc: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  inProgressChip: {
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  inProgressChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: BLUE,
  },
  timelineConnector: {
    width: 2,
    height: 20,
    marginLeft: 15, // align with center of 32px circle (16 - 1 for line width)
    marginVertical: 2,
  },

  waitCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  waitTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#065F46",
    marginBottom: 12,
  },
  waitList: { gap: 8 },
  waitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  waitText: {
    flex: 1,
    fontSize: 13,
    color: "#047857",
  },

  faqsList: { gap: 8 },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
  },
  faqHeaderOpen: {
    backgroundColor: "#F0FDFB",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
  },
  faqAnswerWrap: {
    backgroundColor: "#F0FDFB",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  faqAnswer: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 22,
  },

  helpButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
  },
  helpEmoji: { fontSize: 18 },
  helpText: {
    fontSize: 14,
    fontWeight: "500",
    color: NAVY,
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
