// ══════════════════════════════════════════════════════════════════════════════
// screens/AdvanceApprovalScreen.tsx — ADVANCE-007 disbursement success
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 109-ADVANCE-007-AdvanceApproval.jsx.
//
// Terminal celebration screen shown after an advance is approved.
// Reached from ApplicationFlow's step-3 "Confirm" action.
//
// Layout: teal-gradient hero (different from the rest of the flow
// which uses navy — this is the reward moment), success ring with
// checkmark, "Advance Approved!" title, white amount card, details
// list, navy auto-withholding card, "What happens next" callout, two
// CTAs (View Details + Done).
//
// Route params (all optional — defaults mirror canonical mock):
//   advance?: ApprovedAdvance
//   advanceId?: string                 ← forwarded for the View Details
//                                        button when no full object is
//                                        provided
//
// Navigation:
//   - "View Advance Details" → AdvanceDetailsV2 { advanceId }
//   - "Done" → goBack (typically back to Dashboard)
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
const TEAL_DARK = "#00897B";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#D97706";

type ApprovedAdvance = {
  id: string;
  amount: number;
  fee: number;
  total: number;
  disbursedTo: string;
  disbursedAt: string;
  withholdingDate: string;
  circleName: string;
  payoutAmount: number;
  remainingAfter: number;
  rate: number;
};

type AdvanceApprovalParams = {
  advance?: ApprovedAdvance;
  advanceId?: string;
  // Plus forwarded fields if the caller didn't build a full object
  amount?: number;
  total?: number;
  payoutId?: string;
};
type AdvanceApprovalRouteProp = RouteProp<
  { AdvanceApproval: AdvanceApprovalParams },
  "AdvanceApproval"
>;

const DEFAULT_ADVANCE: ApprovedAdvance = {
  id: "ADV-2025-0120-001",
  amount: 300,
  fee: 15,
  total: 315,
  disbursedTo: "TandaXn Wallet",
  disbursedAt: "Jan 20, 2025 at 2:34 PM",
  withholdingDate: "Feb 15, 2025",
  circleName: "Family Circle",
  payoutAmount: 500,
  remainingAfter: 185,
  rate: 9.5,
};

export default function AdvanceApprovalScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<AdvanceApprovalRouteProp>();

  // Merge: explicit `advance` wins; otherwise build from forwarded
  // SmartCalculator/ApplicationFlow params; otherwise fall back to mock.
  const advance: ApprovedAdvance = route.params?.advance ?? {
    ...DEFAULT_ADVANCE,
    amount: route.params?.amount ?? DEFAULT_ADVANCE.amount,
    total: route.params?.total ?? DEFAULT_ADVANCE.total,
  };

  const whatsNext = [
    "Funds are now in your TandaXn Wallet",
    `On ${advance.withholdingDate}, $${advance.total} will be auto-withheld`,
    "No action needed — repayment is automatic",
  ];

  const handleViewDetails = () =>
    navigation.navigate(Routes.AdvanceDetailsV2, {
      advanceId: advance.id,
    });
  const handleDone = () => navigation.goBack();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TEAL_DARK} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero header — teal gradient */}
        <LinearGradient
          colors={[TEAL, TEAL_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.successRing}>
            <Ionicons name="checkmark" size={50} color="#FFFFFF" />
          </View>
          <Text style={styles.heroTitle}>{t("final_polish.advanceapproval_advance_approved")}</Text>
          <Text style={styles.heroSubtitle}>{t("final_polish.advanceapproval_your_funds_are_on_the_way")}</Text>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Amount Card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>{t("final_polish.advanceapproval_amount_disbursed")}</Text>
            <Text style={styles.amountValue}>${advance.amount}</Text>
            <Text style={styles.amountSub}>
              Sent to {advance.disbursedTo}
            </Text>
          </View>

          {/* Details Card */}
          <View style={styles.sectionCard}>
            <View style={styles.detailsList}>
              <DetailRow label="Advance ID" value={advance.id} />
              <DetailRow label="Disbursed" value={advance.disbursedAt} />
              <DetailRow
                label={`Advance fee (${advance.rate}%)`}
                value={`$${advance.fee}`}
                valueStyle={{ color: AMBER }}
              />
              <View style={styles.divider} />
              <DetailRow
                label="Total to repay"
                labelStrong
                value={`$${advance.total}`}
                valueStyle={styles.detailValueBig}
              />
            </View>
          </View>

          {/* Withholding Card — navy */}
          <View style={styles.withholdCard}>
            <View style={styles.withholdHeader}>
              <View style={styles.withholdIconBox}>
                <Ionicons name="calendar-outline" size={22} color={TEAL} />
              </View>
              <View>
                <Text style={styles.withholdSubLabel}>
                  Auto-Withholding Date
                </Text>
                <Text style={styles.withholdDate}>
                  {advance.withholdingDate}
                </Text>
              </View>
            </View>

            <View style={styles.withholdInner}>
              <WithholdRow
                label={`From ${advance.circleName} payout`}
                value={`$${advance.payoutAmount}`}
                color="#FFFFFF"
              />
              <WithholdRow
                label="Withheld for repayment"
                value={`-$${advance.total}`}
                color={AMBER}
              />
              <View style={styles.withholdInnerDivider} />
              <View style={styles.withholdReceiveRow}>
                <Text style={styles.withholdReceiveLabel}>{t("final_polish.advanceapproval_you_ll_receive")}</Text>
                <Text style={styles.withholdReceiveValue}>
                  ${advance.remainingAfter}
                </Text>
              </View>
            </View>
          </View>

          {/* What's Next */}
          <View style={styles.nextCard}>
            <Text style={styles.nextTitle}>✅ What happens next</Text>
            <View style={styles.nextList}>
              {whatsNext.map((item, idx) => (
                <View key={idx} style={styles.nextRow}>
                  <View style={styles.nextDot} />
                  <Text style={styles.nextText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* View Details button */}
          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={handleViewDetails}
            accessibilityRole="button"
            accessibilityLabel="View advance details"
          >
            <Ionicons name="document-text-outline" size={18} color={NAVY} />
            <Text style={styles.viewDetailsText}>{t("final_polish.advanceapproval_view_advance_details")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={handleDone}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={styles.doneButtonText}>{t("final_polish.advanceapproval_done")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({
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
    <View style={styles.detailRow}>
      <Text
        style={[styles.detailLabel, labelStrong && styles.detailLabelStrong]}
      >
        {label}
      </Text>
      <Text style={[styles.detailValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function WithholdRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.withholdRow}>
      <Text style={styles.withholdLabel}>{label}</Text>
      <Text style={[styles.withholdValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  hero: {
    paddingTop: 40,
    paddingBottom: 100,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  successRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
  },

  contentWrap: { marginTop: -60, paddingHorizontal: 20 },

  amountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  amountLabel: { fontSize: 14, color: MUTED, marginBottom: 8 },
  amountValue: {
    fontSize: 42,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 4,
  },
  amountSub: { fontSize: 13, color: TEAL },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  detailsList: { gap: 6 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  detailLabel: { fontSize: 13, color: MUTED },
  detailLabelStrong: { fontSize: 14, fontWeight: "600", color: NAVY },
  detailValue: { fontSize: 13, fontWeight: "600", color: NAVY },
  detailValueBig: { fontSize: 16, fontWeight: "700", color: NAVY },
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
    gap: 12,
    marginBottom: 12,
  },
  withholdIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  withholdSubLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)" },
  withholdDate: {
    fontSize: 18,
    fontWeight: "700",
    color: TEAL,
    marginTop: 2,
  },
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

  nextCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: TEAL,
  },
  nextTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#065F46",
    marginBottom: 10,
  },
  nextList: { gap: 8 },
  nextRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nextDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TEAL,
  },
  nextText: { flex: 1, fontSize: 12, color: "#047857" },

  viewDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  viewDetailsText: { fontSize: 14, fontWeight: "600", color: NAVY },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  doneButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  doneButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
});
