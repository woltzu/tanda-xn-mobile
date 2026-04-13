import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { useTripPayment } from "../hooks/useTripOrganizer";

const GOLD = "#E8A842";
const GOLD_BG = "rgba(232,168,66,0.1)";
const TEAL = colors.accentTeal;
const NAVY = colors.primaryNavy;
const GREEN = "#10B981";

// ── Types ──────────────────────────────────────────────────────────────────────
interface InstallmentInfo {
  current: number;
  total: number;
  dueDate: string;
  amount: number;
  processingFeePercent: number;
  processingFee: number;
  totalCharged: number;
}

interface PaymentProgress {
  paidSoFar: number;
  totalCost: number;
  afterThisPayment: number;
}

interface PaymentMethod {
  brand: string;
  last4: string;
  expiry: string;
}

interface PaymentData {
  tripId: string;
  tripName: string;
  installment: InstallmentInfo;
  progress: PaymentProgress;
  paymentMethod: PaymentMethod;
}

// ── Mock Data ──────────────────────────────────────────────────────────────────
const MOCK_PAYMENT: PaymentData = {
  tripId: "trip-001",
  tripName: "Abidjan Summer Experience 2026",
  installment: {
    current: 2,
    total: 3,
    dueDate: "May 1, 2026",
    amount: 525.0,
    processingFeePercent: 2.9,
    processingFee: 15.23,
    totalCharged: 540.23,
  },
  progress: {
    paidSoFar: 700,
    totalCost: 1800,
    afterThisPayment: 1225,
  },
  paymentMethod: {
    brand: "Visa",
    last4: "4242",
    expiry: "08/28",
  },
};

// ── Component ──────────────────────────────────────────────────────────────────
const TripPaymentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const tripId = route.params?.tripId ?? MOCK_PAYMENT.tripId;
  const participantId = route.params?.participantId ?? "me";

  const hookResult = useTripPayment(participantId);
  const data: PaymentData = (hookResult as any)?.data ?? MOCK_PAYMENT;
  const processPayment = (hookResult as any)?.pay ?? (async () => {});
  const isLoading = (hookResult as any)?.isLoading ?? false;

  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  const { installment, progress, paymentMethod } = data;

  const currentProgressPercent = Math.round(
    (progress.paidSoFar / progress.totalCost) * 100
  );
  const afterPaymentPercent = Math.round(
    (progress.afterThisPayment / progress.totalCost) * 100
  );

  const handlePay = async () => {
    setIsProcessing(true);
    try {
      await processPayment();
      setIsPaid(true);
    } catch {
      Alert.alert("Payment Failed", "Please check your payment method and try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const cardIcon =
    paymentMethod.brand === "Visa"
      ? "card"
      : paymentMethod.brand === "Mastercard"
      ? "card"
      : "card-outline";

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color={TEAL} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Make Payment</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Success State ───────────────────────────────────────────── */}
        {isPaid ? (
          <View style={styles.successContainer}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={64} color={GREEN} />
            </View>
            <Text style={styles.successTitle}>Payment Successful!</Text>
            <Text style={styles.successAmount}>
              ${installment.totalCharged.toFixed(2)}
            </Text>
            <Text style={styles.successSubtitle}>
              Installment {installment.current} of {installment.total} complete
            </Text>

            <View style={styles.successProgressCard}>
              <Text style={styles.successProgressLabel}>Updated Progress</Text>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressBarFill, { width: `${afterPaymentPercent}%` }]}
                />
              </View>
              <Text style={styles.successProgressText}>
                ${progress.afterThisPayment.toLocaleString()} / $
                {progress.totalCost.toLocaleString()} paid
              </Text>
            </View>

            <TouchableOpacity
              style={styles.successBackButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Text style={styles.successBackButtonText}>Back to My Trip</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Installment Banner ──────────────────────────────────── */}
            <View style={styles.installmentBanner}>
              <View style={styles.installmentBannerLeft}>
                <View style={styles.installmentBadge}>
                  <Ionicons name="calendar" size={14} color={GOLD} />
                </View>
                <View>
                  <Text style={styles.installmentBannerTitle}>
                    Installment {installment.current} of {installment.total} Due
                  </Text>
                  <Text style={styles.installmentBannerDate}>
                    Due by {installment.dueDate}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Payment Breakdown ───────────────────────────────────── */}
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Payment Breakdown</Text>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Installment amount</Text>
                <Text style={styles.breakdownValue}>
                  ${installment.amount.toFixed(2)}
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  Processing fee ({installment.processingFeePercent}%)
                </Text>
                <Text style={styles.breakdownValue}>
                  ${installment.processingFee.toFixed(2)}
                </Text>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownTotalLabel}>Total charged</Text>
                <Text style={styles.breakdownTotalValue}>
                  ${installment.totalCharged.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* ── Payment Progress ────────────────────────────────────── */}
            <View style={styles.progressCard}>
              <Text style={styles.progressCardTitle}>Payment Progress</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressBarFillCurrent,
                    { width: `${currentProgressPercent}%` },
                  ]}
                />
                <View
                  style={[
                    styles.progressBarFillProjected,
                    {
                      width: `${afterPaymentPercent - currentProgressPercent}%`,
                      left: `${currentProgressPercent}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.progressLabelsRow}>
                <View style={styles.progressLegendItem}>
                  <View style={[styles.legendDot, { backgroundColor: TEAL }]} />
                  <Text style={styles.progressLabelText}>
                    Paid: ${progress.paidSoFar.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.progressLegendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "rgba(0,198,174,0.35)" }]} />
                  <Text style={styles.progressLabelText}>
                    After this: ${progress.afterThisPayment.toLocaleString()}
                  </Text>
                </View>
              </View>
              <Text style={styles.progressTargetText}>
                of ${progress.totalCost.toLocaleString()} total
              </Text>
            </View>

            {/* ── Payment Method ──────────────────────────────────────── */}
            <View style={styles.paymentMethodCard}>
              <Text style={styles.paymentMethodTitle}>Payment Method</Text>
              <View style={styles.paymentMethodRow}>
                <View style={styles.cardIconBox}>
                  <Ionicons name={cardIcon} size={24} color={NAVY} />
                </View>
                <View style={styles.cardDetails}>
                  <Text style={styles.cardBrand}>
                    {paymentMethod.brand} ending in {paymentMethod.last4}
                  </Text>
                  <Text style={styles.cardExpiry}>Expires {paymentMethod.expiry}</Text>
                </View>
                <TouchableOpacity style={styles.changeBtn}>
                  <Text style={styles.changeBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Pay Button ────────────────────────────────────────────────── */}
      {!isPaid && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.payButton}
            onPress={handlePay}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={18} color="#FFF" />
                <Text style={styles.payButtonText}>
                  Pay ${installment.totalCharged.toFixed(2)} Now
                </Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.stripeFooter}>
            Powered by Stripe {"\u00B7"} Payments are secure and encrypted
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

export default TripPaymentScreen;

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },

  // ── Installment Banner ──
  installmentBanner: {
    backgroundColor: GOLD_BG,
    marginHorizontal: 16,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  installmentBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  installmentBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(232,168,66,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  installmentBannerTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: 2,
  },
  installmentBannerDate: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },

  // ── Breakdown Card ──
  breakdownCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    borderRadius: radius.card,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  breakdownTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  breakdownLabel: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  breakdownValue: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  breakdownTotalLabel: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
  },
  breakdownTotalValue: {
    fontSize: 22,
    fontWeight: "800",
    color: GOLD,
  },

  // ── Progress Card ──
  progressCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    borderRadius: radius.card,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  progressCardTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: 14,
  },
  progressBar: {
    height: 12,
    backgroundColor: "rgba(0,198,174,0.1)",
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
    marginBottom: 12,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: TEAL,
    borderRadius: 6,
  },
  progressBarFillCurrent: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    backgroundColor: TEAL,
    borderRadius: 6,
    zIndex: 2,
  },
  progressBarFillProjected: {
    position: "absolute",
    top: 0,
    height: "100%",
    backgroundColor: "rgba(0,198,174,0.35)",
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    zIndex: 1,
  },
  progressLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressLabelText: {
    fontSize: typography.label,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  progressTargetText: {
    fontSize: typography.label,
    color: colors.textSecondary,
    textAlign: "right",
  },

  // ── Payment Method ──
  paymentMethodCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 16,
    borderRadius: radius.card,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentMethodTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: NAVY,
    marginBottom: 14,
  },
  paymentMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.small,
    backgroundColor: colors.softerNavyTintBg,
    justifyContent: "center",
    alignItems: "center",
  },
  cardDetails: {
    flex: 1,
  },
  cardBrand: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
    marginBottom: 2,
  },
  cardExpiry: {
    fontSize: typography.label,
    color: colors.textSecondary,
  },
  changeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  changeBtnText: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
    color: NAVY,
  },

  // ── Bottom Bar ──
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GOLD,
    paddingVertical: 16,
    borderRadius: radius.button,
    width: "100%",
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  payButtonText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: "#FFF",
  },
  stripeFooter: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 10,
    textAlign: "center",
  },

  // ── Success State ──
  successContainer: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  successIconCircle: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: NAVY,
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: GOLD,
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  successProgressCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 20,
    width: "100%",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  successProgressLabel: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: NAVY,
    marginBottom: 10,
  },
  successProgressText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
  successBackButton: {
    backgroundColor: NAVY,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: radius.button,
    width: "100%",
    alignItems: "center",
  },
  successBackButtonText: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: "#FFF",
  },
});
