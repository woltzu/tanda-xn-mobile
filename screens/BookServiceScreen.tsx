import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useBookings } from "../hooks/useMarketplace";

export default function BookServiceScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const {
    storeId, storeName, storeEmoji,
    serviceId, serviceName,
    originalAmountCents, discountAmountCents, finalAmountCents,
    memberDiscountPct,
    nextPayoutDate, payoutAmount, circleId, circleName,
    canPayOnPayoutDay,
  } = (route.params as any) ?? {};

  const { createBooking } = useBookings();

  const [paymentType, setPaymentType] = useState<"immediate" | "payout_day">(
    canPayOnPayoutDay ? "payout_day" : "immediate"
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const payoutDateFormatted = nextPayoutDate
    ? new Date(nextPayoutDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : null;

  const daysUntilPayout = nextPayoutDate
    ? Math.max(0, Math.ceil((new Date(nextPayoutDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const handleBook = async () => {
    setSubmitting(true);
    try {
      await createBooking({
        storeId,
        serviceId,
        serviceName,
        originalAmountCents,
        discountAmountCents: discountAmountCents ?? 0,
        finalAmountCents,
        paymentType,
        payoutDate: paymentType === "payout_day" ? nextPayoutDate : undefined,
        circleId: paymentType === "payout_day" ? circleId : undefined,
        notes: notes.trim() || undefined,
      });
      Alert.alert(
        "Booked! 🎉",
        paymentType === "payout_day"
          ? `Your booking is confirmed. Payment of ${formatPrice(finalAmountCents)} will be collected on ${payoutDateFormatted}.`
          : "Your booking is confirmed. You can pay now through your preferred method.",
        [{ text: "OK", onPress: () => navigation.popToTop() }]
      );
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not create booking");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Booking</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Service Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.storeAvatar}>
              <Text style={styles.storeEmoji}>{storeEmoji ?? "🏪"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.storeName}>{storeName}</Text>
              <Text style={styles.serviceName}>{serviceName}</Text>
            </View>
          </View>

          <View style={styles.pricingSection}>
            {discountAmountCents > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Original price</Text>
                <Text style={styles.originalPrice}>{formatPrice(originalAmountCents)}</Text>
              </View>
            )}
            {discountAmountCents > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: "#00C6AE" }]}>Member discount ({memberDiscountPct}%)</Text>
                <Text style={styles.discountPrice}>-{formatPrice(discountAmountCents)}</Text>
              </View>
            )}
            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalPrice}>{formatPrice(finalAmountCents)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <Text style={styles.sectionLabel}>How would you like to pay?</Text>

        {/* Payout Day Option */}
        {canPayOnPayoutDay && (
          <TouchableOpacity
            style={[styles.paymentOption, paymentType === "payout_day" && styles.paymentOptionActive]}
            onPress={() => setPaymentType("payout_day")}
          >
            <View style={[styles.paymentRadio, paymentType === "payout_day" && styles.paymentRadioActive]}>
              {paymentType === "payout_day" && <View style={styles.paymentRadioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.paymentLabelRow}>
                <Text style={styles.paymentLabel}>Pay on Payout Day</Text>
                <View style={styles.recommendedBadge}>
                  <Ionicons name="flash" size={10} color="#F59E0B" />
                  <Text style={styles.recommendedText}>Recommended</Text>
                </View>
              </View>
              <Text style={styles.paymentDesc}>
                {formatPrice(finalAmountCents)} will be automatically deducted from your {circleName ?? "circle"} payout on {payoutDateFormatted}
              </Text>
              <View style={styles.payoutCountdown}>
                <Ionicons name="time-outline" size={14} color="#00C6AE" />
                <Text style={styles.payoutCountdownText}>{daysUntilPayout} days until payout</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Immediate Payment */}
        <TouchableOpacity
          style={[styles.paymentOption, paymentType === "immediate" && styles.paymentOptionActive]}
          onPress={() => setPaymentType("immediate")}
        >
          <View style={[styles.paymentRadio, paymentType === "immediate" && styles.paymentRadioActive]}>
            {paymentType === "immediate" && <View style={styles.paymentRadioDot} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.paymentLabel}>Pay Now</Text>
            <Text style={styles.paymentDesc}>
              Pay {formatPrice(finalAmountCents)} with your debit card or wallet
            </Text>
          </View>
        </TouchableOpacity>

        {/* Notes */}
        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Any special requests..."
          placeholderTextColor="#9CA3AF"
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={300}
        />

        {/* Escrow Notice */}
        {finalAmountCents >= 20000 && (
          <View style={styles.escrowNotice}>
            <Ionicons name="shield-checkmark" size={18} color="#3B82F6" />
            <Text style={styles.escrowText}>
              This payment will be held in escrow until you confirm the service is complete. This protects both you and the provider.
            </Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
          <Text style={styles.infoText}>
            {paymentType === "payout_day"
              ? "Your booking is confirmed immediately. Payment is automatically collected from your circle payout — no action needed on your part."
              : "You'll be redirected to complete payment after confirming."}
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.bookBtn, submitting && { opacity: 0.6 }]}
          onPress={handleBook}
          disabled={submitting}
        >
          <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
          <Text style={styles.bookBtnText}>
            {submitting ? "Booking..." : paymentType === "payout_day" ? `Book — Pay ${payoutDateFormatted}` : `Book & Pay ${formatPrice(finalAmountCents)}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  content: { flex: 1, padding: 20 },

  summaryCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: "#E5E7EB" },
  summaryTop: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  storeAvatar: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#F0FDFB", alignItems: "center", justifyContent: "center", marginRight: 14 },
  storeEmoji: { fontSize: 28 },
  storeName: { fontSize: 14, color: "#6B7280", marginBottom: 2 },
  serviceName: { fontSize: 18, fontWeight: "700", color: "#0A2342" },

  pricingSection: { borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 16 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  priceLabel: { fontSize: 14, color: "#6B7280" },
  originalPrice: { fontSize: 14, color: "#9CA3AF", textDecorationLine: "line-through" },
  discountPrice: { fontSize: 14, fontWeight: "600", color: "#00C6AE" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 12, marginTop: 8 },
  totalLabel: { fontSize: 16, fontWeight: "700", color: "#0A2342" },
  totalPrice: { fontSize: 20, fontWeight: "700", color: "#0A2342" },

  sectionLabel: { fontSize: 15, fontWeight: "600", color: "#0A2342", marginBottom: 12 },

  paymentOption: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: "#E5E7EB", flexDirection: "row", gap: 14 },
  paymentOptionActive: { borderColor: "#00C6AE", backgroundColor: "#F0FDFB" },
  paymentRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center", marginTop: 2 },
  paymentRadioActive: { borderColor: "#00C6AE" },
  paymentRadioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#00C6AE" },
  paymentLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  paymentLabel: { fontSize: 15, fontWeight: "600", color: "#0A2342" },
  recommendedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF3C7", paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 },
  recommendedText: { fontSize: 10, fontWeight: "600", color: "#D97706" },
  paymentDesc: { fontSize: 13, color: "#6B7280", lineHeight: 18 },
  payoutCountdown: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  payoutCountdownText: { fontSize: 13, fontWeight: "600", color: "#00C6AE" },

  notesInput: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, fontSize: 15, color: "#0A2342", borderWidth: 1, borderColor: "#E5E7EB", minHeight: 80, textAlignVertical: "top", marginBottom: 16 },

  escrowNotice: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#BFDBFE" },
  escrowText: { flex: 1, fontSize: 13, color: "#1E40AF", lineHeight: 18 },

  infoCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14 },
  infoText: { flex: 1, fontSize: 13, color: "#6B7280", lineHeight: 18 },

  bottomBar: { padding: 20, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  bookBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#00C6AE", borderRadius: 14, paddingVertical: 16 },
  bookBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
