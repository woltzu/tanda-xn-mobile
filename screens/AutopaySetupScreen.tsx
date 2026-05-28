// ══════════════════════════════════════════════════════════════════════════════
// screens/AutopaySetupScreen.tsx — ADVANCE-015 early-repayment autopay
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 117-ADVANCE-015-AutopaySetup.jsx.
//
// IMPORTANT framing: advance repayment is auto-withheld from payouts
// by DEFAULT. This screen is purely for *optional* early-repayment
// autopay (pay off from wallet before the payout date to save fees).
//
// Controls:
//   - autopay toggle (when wallet >= total due, auto-pay early)
//   - payment-method picker (shown only when autopay is on)
//   - reminder-days selector (1 / 3 / 5 / 7 days before withholding)
//
// Route params (all optional, defaults match canonical mock):
//   activeAdvance?: { id; amount; totalDue; withholdingDate; daysUntil }
//   paymentMethods?: PaymentMethod[]
//
// Navigation:
//   - back → goBack
//   - "Save Settings" → Alert success → goBack (Phase 3 persists to
//     a real settings table)
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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type PaymentMethod = {
  id: string;
  name: string;
  balance?: number;
  icon: string;
  default?: boolean;
};

type ActiveAdvance = {
  id: string;
  amount: number;
  totalDue: number;
  withholdingDate: string;
  daysUntil: number;
};

type AutopaySetupParams = {
  activeAdvance?: ActiveAdvance;
  paymentMethods?: PaymentMethod[];
};
type AutopaySetupRouteProp = RouteProp<
  { AutopaySetup: AutopaySetupParams },
  "AutopaySetup"
>;

const DEFAULT_ADVANCE: ActiveAdvance = {
  id: "ADV-2025-0120-001",
  amount: 300,
  totalDue: 315,
  withholdingDate: "Feb 15, 2025",
  daysUntil: 25,
};

const DEFAULT_METHODS: PaymentMethod[] = [
  { id: "wallet", name: "TandaXn Wallet", balance: 450, icon: "💳", default: true },
  { id: "bank1", name: "Chase Checking ••••4521", icon: "🏦", default: false },
];

const REMINDER_OPTIONS = [1, 3, 5, 7];

const BENEFITS = [
  { icon: "💰", text: "Save on advance fees (pro-rated)" },
  { icon: "⭐", text: "+2 bonus XnScore points" },
  { icon: "🔓", text: "Keep your full payout" },
  { icon: "📈", text: "Better rates on future advances" },
];

// Simple toggle — RN has no animated CSS transition out of the box,
// so the knob just snaps to the new side. A future polish pass can
// wrap this in Animated for a smooth slide.
function Toggle({
  value,
  onToggle,
  accessibilityLabel,
}: {
  value: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.toggle, value && styles.toggleOn]}
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
    </TouchableOpacity>
  );
}

export default function AutopaySetupScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<AutopaySetupRouteProp>();

  const activeAdvance = route.params?.activeAdvance ?? DEFAULT_ADVANCE;
  const paymentMethods = route.params?.paymentMethods ?? DEFAULT_METHODS;

  const [autopayEnabled, setAutopayEnabled] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string>(
    paymentMethods[0]?.id ?? "wallet",
  );
  const [reminderDays, setReminderDays] = useState(3);

  const handleSave = () => {
    // Phase 3: persist { autopayEnabled, selectedMethod, reminderDays }
    // to a real advance-settings table.
    Alert.alert(
      "Settings Saved",
      "Your repayment preferences have been updated.",
      [{ text: "OK", onPress: () => navigation.goBack() }],
    );
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
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Repayment Settings</Text>
              <Text style={styles.headerSubtitle}>
                Manage your advance repayment
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* How repayment works */}
          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#00897B"
              style={{ marginTop: 2 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>How repayment works</Text>
              <Text style={styles.infoBody}>
                By default, your advance is{" "}
                <Text style={styles.infoStrong}>
                  auto-withheld from your circle payout
                </Text>{" "}
                on {activeAdvance.withholdingDate}. No action needed!
                {"\n\n"}
                The settings below are for{" "}
                <Text style={styles.infoStrong}>optional early repayment</Text>{" "}
                if you want to pay off before your payout date.
              </Text>
            </View>
          </View>

          {/* Current advance */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Current Advance</Text>
            <View style={styles.advanceRow}>
              <View>
                <Text style={styles.advanceLabel}>Amount due</Text>
                <Text style={styles.advanceAmount}>
                  ${activeAdvance.totalDue}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.advanceLabel}>Auto-withhold on</Text>
                <Text style={styles.advanceDate}>
                  {activeAdvance.withholdingDate}
                </Text>
                <Text style={styles.advanceDays}>
                  {activeAdvance.daysUntil} days
                </Text>
              </View>
            </View>
          </View>

          {/* Early repayment autopay */}
          <View style={styles.sectionCard}>
            <View style={styles.toggleHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.sectionTitle}>
                  Early Repayment Autopay
                </Text>
                <Text style={styles.toggleHint}>
                  Automatically repay early when you have sufficient funds
                </Text>
              </View>
              <Toggle
                value={autopayEnabled}
                onToggle={() => setAutopayEnabled(!autopayEnabled)}
                accessibilityLabel="Toggle early repayment autopay"
              />
            </View>

            {autopayEnabled && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.fieldLabelSmall}>Pay from</Text>
                <View style={styles.methodsList}>
                  {paymentMethods.map((method) => {
                    const selected = selectedMethod === method.id;
                    return (
                      <TouchableOpacity
                        key={method.id}
                        style={[
                          styles.methodRow,
                          selected && styles.methodRowSelected,
                        ]}
                        onPress={() => setSelectedMethod(method.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={method.name}
                      >
                        <View style={styles.methodLeft}>
                          <Text style={styles.methodIcon}>{method.icon}</Text>
                          <View>
                            <Text style={styles.methodName}>{method.name}</Text>
                            {method.balance != null && (
                              <Text style={styles.methodSub}>
                                Balance: ${method.balance}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View
                          style={[
                            styles.radioDot,
                            selected && styles.radioDotSelected,
                          ]}
                        >
                          {selected && (
                            <Ionicons
                              name="checkmark"
                              size={10}
                              color="#FFFFFF"
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.autoTriggerNote}>
                  <Text style={styles.autoTriggerText}>
                    When enabled: If your wallet balance exceeds $
                    {activeAdvance.totalDue}, we'll automatically pay off your
                    advance early, saving you fees.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Reminder days */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Reminder Before Withholding</Text>
            <Text style={styles.reminderHint}>
              Get notified before your payout withholding date
            </Text>
            <View style={styles.reminderRow}>
              {REMINDER_OPTIONS.map((days) => {
                const selected = reminderDays === days;
                return (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.reminderButton,
                      selected && styles.reminderButtonSelected,
                    ]}
                    onPress={() => setReminderDays(days)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${days} ${days === 1 ? "day" : "days"} before`}
                  >
                    <Text style={styles.reminderValue}>{days}</Text>
                    <Text style={styles.reminderUnit}>
                      {days === 1 ? "day" : "days"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Benefits */}
          <View style={styles.sectionCard}>
            <Text style={styles.benefitsTitle}>
              Benefits of early repayment:
            </Text>
            <View style={styles.benefitsList}>
              {BENEFITS.map((b, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>{b.icon}</Text>
                  <Text style={styles.benefitText}>{b.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save settings"
        >
          <Text style={styles.primaryButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },

  contentWrap: { padding: 20 },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: TEAL,
  },
  infoTitle: { fontSize: 13, fontWeight: "600", color: "#065F46" },
  infoBody: {
    fontSize: 12,
    color: "#047857",
    lineHeight: 18,
    marginTop: 6,
  },
  infoStrong: { fontWeight: "700" },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: NAVY },

  advanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  advanceLabel: { fontSize: 12, color: MUTED },
  advanceAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },
  advanceDate: {
    fontSize: 14,
    fontWeight: "600",
    color: TEAL,
    marginTop: 2,
  },
  advanceDays: { fontSize: 11, color: MUTED, marginTop: 2 },

  toggleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  toggleHint: { fontSize: 12, color: MUTED, marginTop: 4 },

  toggle: {
    width: 52,
    height: 28,
    borderRadius: 14,
    backgroundColor: BORDER,
    padding: 2,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: TEAL },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobOn: { alignSelf: "flex-end" },

  fieldLabelSmall: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 8,
  },
  methodsList: { gap: 8 },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  methodRowSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: TEAL,
    margin: -1,
  },
  methodLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  methodIcon: { fontSize: 18 },
  methodName: { fontSize: 13, fontWeight: "600", color: NAVY },
  methodSub: { fontSize: 11, color: MUTED, marginTop: 2 },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotSelected: { backgroundColor: TEAL, borderColor: TEAL },

  autoTriggerNote: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 8,
  },
  autoTriggerText: { fontSize: 12, color: MUTED, lineHeight: 18 },

  reminderHint: { fontSize: 12, color: MUTED, marginTop: 4, marginBottom: 12 },
  reminderRow: { flexDirection: "row", gap: 8 },
  reminderButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  reminderButtonSelected: {
    borderWidth: 2,
    borderColor: TEAL,
    backgroundColor: "#F0FDFB",
  },
  reminderValue: { fontSize: 16, fontWeight: "700", color: NAVY },
  reminderUnit: { fontSize: 10, color: MUTED, marginTop: 2 },

  benefitsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 10,
  },
  benefitsList: { gap: 8 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitIcon: { fontSize: 16 },
  benefitText: { flex: 1, fontSize: 12, color: "#4B5563" },

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
  primaryButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
});
