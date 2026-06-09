// ══════════════════════════════════════════════════════════════════════════════
// screens/AdvanceDetailsV2Screen.tsx — ADVANCE-009 single advance details (V2)
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 111-ADVANCE-009-AdvanceDetails.jsx.
//
// V2 NAMING NOTE — the existing AdvanceDetailsScreen.tsx (750 lines)
// is intentionally NOT replaced. Both coexist until a future
// red-emoji-gated decision on which to retire.
//
// Single-advance detail screen showing full info, timeline, and
// action set. Top header carries the navy gradient with the
// "Advanced" and "To Repay" amount pair plus a status badge.
//
// Route params (all optional — defaults mirror canonical mock):
//   advanceId?: string                  ← lookup key (real data via
//                                         AdvanceContext in Phase 3)
//   advance?: AdvanceDetails            ← pre-resolved object (used
//                                         when caller already has it)
//
// Navigation:
//   - back → goBack
//   - "Repay Early" → EarlyRepayment { advanceId }
//   - "Request Hardship Assistance" → HardshipRequest { advanceId }
//   - "View Agreement" → AdvanceAgreement { advanceId }
//   - "Contact Support" → HelpCenter (existing)
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
const AMBER = "#D97706";

type AdvanceStatus = "active" | "repaid" | "defaulted";

type TimelineItem = {
  date: string;
  event: string;
  status: "completed" | "pending";
};

type AdvanceDetails = {
  id: string;
  type: string;
  typeName: string;
  icon: string;
  status: AdvanceStatus;
  advancedAmount: number;
  fee: number;
  totalDue: number;
  rate: number;
  disbursedTo: string;
  disbursedDate: string;
  withholdingDate: string;
  daysRemaining: number;
  circleName: string;
  payoutAmount: number;
  remainingAfterRepay: number;
  xnScoreAtApplication: number;
  timeline: TimelineItem[];
};

type AdvanceDetailsV2Params = {
  advanceId?: string;
  advance?: AdvanceDetails;
};
type AdvanceDetailsV2RouteProp = RouteProp<
  { AdvanceDetailsV2: AdvanceDetailsV2Params },
  "AdvanceDetailsV2"
>;

const DEFAULT_ADVANCE: AdvanceDetails = {
  id: "ADV-2025-0120-001",
  type: "quick",
  typeName: "Quick Advance",
  icon: "⚡",
  status: "active",
  advancedAmount: 300,
  fee: 15,
  totalDue: 315,
  rate: 9.5,
  disbursedTo: "TandaXn Wallet",
  disbursedDate: "Jan 20, 2025",
  withholdingDate: "Feb 15, 2025",
  daysRemaining: 25,
  circleName: "Family Circle",
  payoutAmount: 500,
  remainingAfterRepay: 185,
  xnScoreAtApplication: 78,
  timeline: [
    { date: "Jan 20, 2025", event: "Advance approved", status: "completed" },
    { date: "Jan 20, 2025", event: "$300 disbursed to wallet", status: "completed" },
    { date: "Feb 15, 2025", event: "$315 auto-withheld from payout", status: "pending" },
    { date: "Feb 15, 2025", event: "Advance closed", status: "pending" },
  ],
};

function statusBadgeStyle(status: AdvanceStatus) {
  switch (status) {
    case "active":
      return { label: "Active", bg: "#F0FDFB", color: "#00897B" };
    case "repaid":
      return { label: "Repaid ✓", bg: "#F0FDF4", color: "#166534" };
    case "defaulted":
      return { label: "Missed Withholding", bg: "#FEE2E2", color: "#DC2626" };
  }
}

export default function AdvanceDetailsV2Screen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<AdvanceDetailsV2RouteProp>();
  const advance = route.params?.advance ?? DEFAULT_ADVANCE;
  const advanceId = route.params?.advanceId ?? advance.id;
  const badge = statusBadgeStyle(advance.status);

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
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{t("screen_headers.advance_details")}</Text>
              <Text style={styles.headerId}>{advanceId}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          </View>

          {/* Amount pair */}
          <View style={styles.amountRow}>
            <View>
              <Text style={styles.amountLabel}>{t("final_polish.advancedetailsv2_advanced")}</Text>
              <Text style={styles.amountBig}>${advance.advancedAmount}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.amountLabel}>{t("final_polish.advancedetailsv2_to_repay")}</Text>
              <Text style={styles.amountTeal}>${advance.totalDue}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Type card */}
          <View style={styles.sectionCard}>
            <View style={styles.typeRow}>
              <View style={styles.typeIconBox}>
                <Text style={styles.typeIcon}>{advance.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.typeName}>{advance.typeName}</Text>
                <Text style={styles.typeSub}>
                  From {advance.circleName} • Rate: {advance.rate}%
                </Text>
              </View>
            </View>
          </View>

          {/* Info grid */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("final_polish.advancedetailsv2_advance_information")}</Text>
            <View style={styles.infoList}>
              <InfoRow
                label="Advance amount"
                value={`$${advance.advancedAmount}`}
              />
              <InfoRow
                label={`Advance fee (${advance.rate}%)`}
                value={`$${advance.fee}`}
                valueStyle={{ color: AMBER }}
              />
              <View style={styles.divider} />
              <InfoRow
                label="Total to repay"
                labelStrong
                value={`$${advance.totalDue}`}
                valueStyle={styles.infoValueBig}
              />
              <View style={styles.divider} />
              <InfoRow label="Disbursed to" value={advance.disbursedTo} />
              <InfoRow label="Disbursed on" value={advance.disbursedDate} />
              <InfoRow
                label="XnScore at application"
                value={String(advance.xnScoreAtApplication)}
                valueStyle={{ color: TEAL }}
              />
            </View>
          </View>

          {/* Withholding info (active only) */}
          {advance.status === "active" && (
            <View style={styles.withholdCard}>
              <View style={styles.withholdHeader}>
                <Ionicons name="time-outline" size={20} color={TEAL} />
                <Text style={styles.withholdHeaderText}>
                  Auto-Withholding in {advance.daysRemaining} days
                </Text>
              </View>
              <View style={styles.withholdInner}>
                <WithholdRow
                  label="Withholding date"
                  value={advance.withholdingDate}
                  valueColor={TEAL}
                />
                <WithholdRow
                  label="From payout"
                  value={`$${advance.payoutAmount}`}
                  valueColor="#FFFFFF"
                />
                <WithholdRow
                  label="Withheld"
                  value={`-$${advance.totalDue}`}
                  valueColor={AMBER}
                />
                <View style={styles.withholdInnerDivider} />
                <View style={styles.withholdReceiveRow}>
                  <Text style={styles.withholdReceiveLabel}>{t("final_polish.advancedetailsv2_you_ll_receive")}</Text>
                  <Text style={styles.withholdReceiveValue}>
                    ${advance.remainingAfterRepay}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Timeline */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("final_polish.advancedetailsv2_timeline")}</Text>
            <View>
              {advance.timeline.map((item, idx) => {
                const isLast = idx === advance.timeline.length - 1;
                const isCompleted = item.status === "completed";
                return (
                  <View key={idx} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View
                        style={[
                          styles.timelineDot,
                          isCompleted
                            ? styles.timelineDotCompleted
                            : styles.timelineDotPending,
                        ]}
                      />
                      {!isLast && (
                        <View
                          style={[
                            styles.timelineConnector,
                            {
                              backgroundColor: isCompleted ? TEAL : BORDER,
                            },
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.timelineBody}>
                      <Text style={styles.timelineEvent}>{item.event}</Text>
                      <Text style={styles.timelineDate}>{item.date}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Actions (active only) */}
          {advance.status === "active" && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t("final_polish.advancedetailsv2_actions")}</Text>
              <View style={styles.actionsList}>
                <TouchableOpacity
                  style={styles.repayButton}
                  onPress={() =>
                    navigation.navigate(Routes.EarlyRepayment, {
                      advanceId,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Repay early"
                >
                  <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.repayButtonText}>
                    Repay Early — Save on Fees
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.hardshipButton}
                  onPress={() =>
                    navigation.navigate(Routes.HardshipRequest, {
                      advanceId,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Request hardship assistance"
                >
                  <Text style={styles.hardshipButtonText}>
                    Request Hardship Assistance
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Quick links */}
          <View style={styles.linksList}>
            <LinkRow
              icon="document-text-outline"
              label="View Agreement"
              onPress={() =>
                navigation.navigate(Routes.AdvanceAgreement, { advanceId })
              }
            />
            <LinkRow
              icon="chatbubble-outline"
              label="Contact Support"
              onPress={() => navigation.navigate(Routes.HelpCenter)}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  labelStrong,
  valueStyle,
}: {
  label: string;
  value: string;
  labelStrong?: boolean;
  valueStyle?: any;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, labelStrong && styles.infoLabelStrong]}>
        {label}
      </Text>
      <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function WithholdRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <View style={styles.withholdRow}>
      <Text style={styles.withholdLabel}>{label}</Text>
      <Text style={[styles.withholdValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.linkRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.linkLeft}>
        <Ionicons name={icon} size={18} color={MUTED} />
        <Text style={styles.linkText}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={MUTED} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  header: { paddingTop: 20, paddingBottom: 80, paddingHorizontal: 20 },
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
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerId: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: { fontSize: 12, fontWeight: "600" },

  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  amountBig: { fontSize: 36, fontWeight: "700", color: "#FFFFFF" },
  amountTeal: { fontSize: 24, fontWeight: "700", color: TEAL },

  contentWrap: { marginTop: -40, paddingHorizontal: 20 },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 12,
  },

  typeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  typeIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  typeIcon: { fontSize: 26 },
  typeName: { fontSize: 16, fontWeight: "700", color: NAVY },
  typeSub: { fontSize: 12, color: MUTED, marginTop: 4 },

  infoList: { gap: 6 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 13, color: MUTED },
  infoLabelStrong: { fontSize: 14, fontWeight: "600", color: NAVY },
  infoValue: { fontSize: 14, fontWeight: "600", color: NAVY },
  infoValueBig: { fontSize: 16, fontWeight: "700", color: NAVY },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 4 },

  withholdCard: {
    backgroundColor: NAVY,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  withholdHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  withholdHeaderText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  withholdInner: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 12,
  },
  withholdRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  withholdLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  withholdValue: { fontSize: 14, fontWeight: "600" },
  withholdInnerDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: 6,
  },
  withholdReceiveRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  withholdReceiveLabel: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  withholdReceiveValue: { fontSize: 18, fontWeight: "700", color: TEAL },

  timelineRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  timelineLeft: { alignItems: "center" },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineDotCompleted: { backgroundColor: TEAL },
  timelineDotPending: {
    backgroundColor: "#E5E7EB",
    borderWidth: 2,
    borderColor: TEAL,
  },
  timelineConnector: { width: 2, height: 36 },
  timelineBody: { flex: 1, paddingBottom: 16 },
  timelineEvent: { fontSize: 13, fontWeight: "600", color: NAVY },
  timelineDate: { fontSize: 11, color: MUTED, marginTop: 2 },

  actionsList: { gap: 10 },
  repayButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: TEAL,
  },
  repayButtonText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  hardshipButton: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  hardshipButtonText: { fontSize: 14, fontWeight: "600", color: NAVY },

  linksList: { gap: 8 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  linkLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  linkText: { fontSize: 13, fontWeight: "500", color: NAVY },
});
