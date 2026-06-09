// ══════════════════════════════════════════════════════════════════════════════
// screens/AdvanceAgreementScreen.tsx — ADVANCE-011 read-only legal terms
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 113-ADVANCE-011-AdvanceAgreement.jsx.
//
// Read-only legal agreement screen reached from AdvanceDetailsV2's
// "View Agreement" link. Carries 9 sections of advance-payout terms
// + a key-terms summary card + an "Agreement Accepted" footer that
// shows the borrower's name and effective date.
//
// The original had a "PDF" button in the sticky header for
// downloading the agreement. Phase 1 placeholder: Alert.alert
// acknowledging the download isn't wired yet. Phase 3 will hook to
// a real PDF generation/storage endpoint or open WebView with a
// hosted PDF URL.
//
// Route params (all optional, defaults match canonical mock):
//   advance?: { id; amount; fee; total; rate; circleName;
//              payoutAmount; withholdingDate }
//   agreementDate?: string
//   userName?: string
//   advanceId?: string  ← forwarded from AdvanceDetailsV2; falls
//                         through to advance.id
//
// Navigation:
//   - back → goBack
//   - PDF → Alert placeholder (no nav)
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
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#D97706";

type Advance = {
  id: string;
  amount: number;
  fee: number;
  total: number;
  rate: number;
  circleName: string;
  payoutAmount: number;
  withholdingDate: string;
};

type AdvanceAgreementParams = {
  advance?: Advance;
  agreementDate?: string;
  userName?: string;
  advanceId?: string;
};
type AdvanceAgreementRouteProp = RouteProp<
  { AdvanceAgreement: AdvanceAgreementParams },
  "AdvanceAgreement"
>;

const DEFAULT_ADVANCE: Advance = {
  id: "ADV-2025-0120-001",
  amount: 300,
  fee: 15,
  total: 315,
  rate: 9.5,
  circleName: "Family Circle",
  payoutAmount: 500,
  withholdingDate: "Feb 15, 2025",
};

function buildSections(advance: Advance) {
  return [
    {
      title: "1. NATURE OF ADVANCE",
      content: `This Advance Payout Agreement ("Agreement") is NOT a traditional loan. You are receiving early access to your own future circle payout from "${advance.circleName}". TandaXn is advancing you funds that you have already earned through your circle participation.`,
    },
    {
      title: "2. ADVANCE TERMS",
      content: `Advance Amount: $${advance.amount}\nAdvance Fee (${advance.rate}%): $${advance.fee}\nTotal to Repay: $${advance.total}\n\nThis advance is secured by your upcoming payout of $${advance.payoutAmount} scheduled for ${advance.withholdingDate}.`,
    },
    {
      title: "3. AUTO-WITHHOLDING AUTHORIZATION",
      content: `By accepting this advance, you authorize TandaXn to automatically withhold $${advance.total} from your circle payout on ${advance.withholdingDate}. No additional action is required from you. After withholding, the remaining balance of $${advance.payoutAmount - advance.total} will be credited to your wallet.`,
    },
    {
      title: "4. EARLY REPAYMENT",
      content:
        "You may repay this advance early at any time without penalty. Early repayment will result in a reduced advance fee calculated on a pro-rata basis. Early repayment positively impacts your XnScore.",
    },
    {
      title: "5. MISSED WITHHOLDING (DEFAULT)",
      content:
        "If your payout is insufficient to cover the advance:\n\n• Your XnScore will decrease by 20 points\n• You may be restricted from joining new circles\n• You may be ineligible for future advances\n• The outstanding balance will be deducted from future payouts\n\nTandaXn does NOT use external collection agencies. All collection occurs within the TandaXn ecosystem.",
    },
    {
      title: "6. XNSCORE IMPACT",
      content:
        "Your XnScore (Trust Score) is affected as follows:\n\n• On-time repayment: +1 to +5 points (based on advance size)\n• Early repayment: Additional +2 points\n• Missed withholding: -20 points\n\nYour current XnScore determines your eligibility for future advances and rates offered.",
    },
    {
      title: "7. NO TRADITIONAL CREDIT REPORTING",
      content:
        "TandaXn does not report to traditional credit bureaus. This advance will not appear on your credit report. However, your TandaXn XnScore is maintained internally and affects your standing within the TandaXn community.",
    },
    {
      title: "8. DISPUTE RESOLUTION",
      content:
        "Any disputes regarding this advance will be resolved through TandaXn's internal dispute resolution process. You may contact support at any time to discuss hardship options or payment arrangements.",
    },
    {
      title: "9. ACKNOWLEDGMENT",
      content:
        "By accepting this advance, you acknowledge that:\n\n• You understand this is an advance on your future payout, not a loan\n• You authorize auto-withholding from your payout\n• You understand the XnScore consequences of non-payment\n• You have read and agree to these terms",
    },
  ];
}

export default function AdvanceAgreementScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<AdvanceAgreementRouteProp>();

  const advance = route.params?.advance ?? DEFAULT_ADVANCE;
  const advanceId = route.params?.advanceId ?? advance.id;
  const agreementDate = route.params?.agreementDate ?? "Jan 20, 2025";
  const userName = route.params?.userName ?? "Franck";
  const sections = buildSections(advance);

  const handleDownload = () => {
    Alert.alert(
      "Download PDF",
      "PDF download will be implemented in Phase 3. The agreement is fully visible below.",
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Sticky header (outside ScrollView so it stays visible) */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>{t("screen_headers.advance_agreement")}</Text>
            <Text style={styles.headerSubtitle}>{advanceId}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.pdfButton}
          onPress={handleDownload}
          accessibilityRole="button"
          accessibilityLabel="Download agreement PDF"
        >
          <Ionicons name="download-outline" size={14} color="#FFFFFF" />
          <Text style={styles.pdfButtonText}>{t("final_polish.advanceagreement_pdf")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header info card */}
        <View style={styles.sectionCard}>
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <Text style={styles.documentTitle}>{t("final_polish.advanceagreement_advance_payout_agreement")}</Text>
            <Text style={styles.documentSubtitle}>
              TandaXn Inc. • Effective Date: {agreementDate}
            </Text>
          </View>

          <View style={styles.metaGrid}>
            <MetaCell label="Borrower" value={userName} />
            <MetaCell
              label="Advance Amount"
              value={`$${advance.amount}`}
              valueColor={TEAL}
            />
            <MetaCell label="Circle" value={advance.circleName} />
            <MetaCell label="Total Due" value={`$${advance.total}`} />
          </View>
        </View>

        {/* Key Terms callout */}
        <View style={styles.keyTermsCard}>
          <Ionicons
            name="information-circle"
            size={20}
            color={AMBER}
            style={{ marginTop: 2 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.keyTermsTitle}>{t("final_polish.advanceagreement_key_terms_summary")}</Text>
            <View style={styles.keyTermsList}>
              <Text style={styles.keyTermsItem}>
                • ${advance.total} will be auto-withheld from your $
                {advance.payoutAmount} payout
              </Text>
              <Text style={styles.keyTermsItem}>
                • Withholding date: {advance.withholdingDate}
              </Text>
              <Text style={styles.keyTermsItem}>
                • Missed withholding = -20 XnScore points
              </Text>
              <Text style={styles.keyTermsItem}>
                • No external collection agencies
              </Text>
            </View>
          </View>
        </View>

        {/* Agreement sections */}
        <View style={[styles.sectionCard, { paddingVertical: 20 }]}>
          {sections.map((section, idx) => {
            const isLast = idx === sections.length - 1;
            return (
              <View key={idx} style={{ marginBottom: isLast ? 0 : 20 }}>
                <Text style={styles.sectionHeading}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.content}</Text>
                {!isLast && <View style={styles.sectionDivider} />}
              </View>
            );
          })}
        </View>

        {/* Acceptance footer */}
        <View style={styles.acceptanceCard}>
          <Ionicons
            name="checkmark-circle"
            size={32}
            color={TEAL}
            style={{ marginBottom: 8 }}
          />
          <Text style={styles.acceptanceTitle}>{t("final_polish.advanceagreement_agreement_accepted")}</Text>
          <Text style={styles.acceptanceSub}>
            {userName} • {agreementDate}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaCell({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },

  // Sticky header (not in ScrollView)
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  pdfButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
  },
  pdfButtonText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 8,
    textAlign: "center",
  },
  documentSubtitle: {
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
  },

  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    gap: 12,
  },
  metaCell: {
    width: "47%",
  },
  metaLabel: { fontSize: 11, color: MUTED },
  metaValue: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginTop: 2,
  },

  keyTermsCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AMBER,
  },
  keyTermsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 8,
  },
  keyTermsList: { gap: 4 },
  keyTermsItem: {
    fontSize: 12,
    color: "#B45309",
    lineHeight: 20,
  },

  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 22,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginTop: 20,
  },

  acceptanceCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: TEAL,
    alignItems: "center",
  },
  acceptanceTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#065F46",
    marginBottom: 4,
  },
  acceptanceSub: { fontSize: 12, color: "#047857" },
});
