// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalLinkCircleScreen.tsx — GOALS-010
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 161-GOALS-010-GoalLinkCircle.jsx.
//
// Link a Circle to a Goal so Circle payouts auto-transfer to the Goal
// ("forced savings"). Pick a circle, choose a transfer rule (all / a
// percentage / ask each time), and preview the outcome.
//
// SLIDER NOTE — the web used <input type="range" step=10>. Per the batch
// brief we replace it with a discrete percentage button row
// (10/25/50/75/100) — no new slider dependency, mirroring the quick-button
// approach in SmartCalculatorScreen.
//
// NAVIGATION — translation-only batch. onBack → goBack(); link / unlink
// resolve to "coming soon" Alert placeholders tagged TODO(goals-wiring).
//
// Route params (all optional — defaults applied for standalone preview).
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
const GREEN = "#059669";
const RED = "#DC2626";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type TransferOption = "all" | "percent" | "ask";

type LinkGoal = {
  id: string;
  name: string;
  emoji: string;
  balance: number;
  target: number;
  linkedCircleId: string | null;
};

type Circle = {
  id: string;
  name: string;
  emoji: string;
  monthlyPayout: number;
  nextPayoutDate: string;
  members: number;
  yourPosition: number;
  isActive: boolean;
};

type GoalLinkCircleParams = {
  goal?: LinkGoal;
  availableCircles?: Circle[];
};
type GoalLinkCircleRouteProp = RouteProp<
  { GoalLinkCircle: GoalLinkCircleParams },
  "GoalLinkCircle"
>;

const DEFAULT_GOAL: LinkGoal = {
  id: "g1",
  name: "First Home in Atlanta",
  emoji: "🏠",
  balance: 8500.0,
  target: 25000.0,
  linkedCircleId: null,
};

const DEFAULT_CIRCLES: Circle[] = [
  {
    id: "c1",
    name: "Home Buyers Circle",
    emoji: "🏠",
    monthlyPayout: 2000,
    nextPayoutDate: "Feb 15, 2026",
    members: 10,
    yourPosition: 4,
    isActive: true,
  },
  {
    id: "c2",
    name: "Abidjan Savers",
    emoji: "🌍",
    monthlyPayout: 500,
    nextPayoutDate: "Feb 20, 2026",
    members: 8,
    yourPosition: 2,
    isActive: true,
  },
  {
    id: "c3",
    name: "Atlanta Diaspora Circle",
    emoji: "🇺🇸",
    monthlyPayout: 1000,
    nextPayoutDate: "Mar 1, 2026",
    members: 12,
    yourPosition: 7,
    isActive: true,
  },
];

const PERCENT_OPTIONS = [10, 25, 50, 75, 100];

/** Radio indicator: filled teal + check when selected, hollow ring otherwise. */
function Radio({ selected, size = 22 }: { selected: boolean; size?: number }) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
        },
        selected
          ? { backgroundColor: TEAL }
          : { borderWidth: 2, borderColor: "#D1D5DB" },
      ]}
    >
      {selected && (
        <Ionicons name="checkmark" size={Math.round(size * 0.55)} color="#FFFFFF" />
      )}
    </View>
  );
}

export default function GoalLinkCircleScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<GoalLinkCircleRouteProp>();

  const goal = route.params?.goal ?? DEFAULT_GOAL;
  const availableCircles = route.params?.availableCircles ?? DEFAULT_CIRCLES;

  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(
    goal.linkedCircleId
  );
  const [transferOption, setTransferOption] = useState<TransferOption>("all");
  const [transferPercent, setTransferPercent] = useState(100);

  const selectedCircle = availableCircles.find((c) => c.id === selectedCircleId);
  const payout = selectedCircle?.monthlyPayout ?? 0;
  const toGoal = (payout * transferPercent) / 100;
  const toWallet = (payout * (100 - transferPercent)) / 100;

  // TODO(goals-wiring): persist via SavingsContext then goBack / success.
  const comingSoon = (label: string) =>
    Alert.alert(label, "This will be available soon.");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HEADER ===== */}
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
            <Text style={styles.headerTitle}>Link Circle to Goal</Text>
          </View>

          {/* Goal preview */}
          <View style={styles.goalSummary}>
            <View style={styles.goalEmojiBox}>
              <Text style={styles.goalEmoji}>{goal.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalName}>{goal.name}</Text>
              <Text style={styles.goalMeta}>
                ${goal.balance.toLocaleString()} of $
                {goal.target.toLocaleString()} saved
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ===== CONTENT ===== */}
        <View style={styles.contentWrap}>
          {/* Explanation */}
          <View style={styles.explainCard}>
            <Text style={styles.explainEmoji}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.explainTitle}>How this works</Text>
              <Text style={styles.explainBody}>
                When you receive a Circle payout, we'll automatically transfer it
                to this Goal. This creates{" "}
                <Text style={styles.explainBold}>forced savings</Text> — your
                money goes straight to your goal and starts earning interest
                immediately.
              </Text>
            </View>
          </View>

          {/* Select circle */}
          <View style={styles.card}>
            <Text style={[styles.fieldLabel, { marginBottom: 12 }]}>
              SELECT A CIRCLE TO LINK
            </Text>
            <View style={{ gap: 10 }}>
              {availableCircles.map((circle) => {
                const isSel = selectedCircleId === circle.id;
                return (
                  <TouchableOpacity
                    key={circle.id}
                    onPress={() => setSelectedCircleId(circle.id)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel }}
                    style={[styles.circleRow, isSel && styles.circleRowSelected]}
                  >
                    <View style={styles.circleLeft}>
                      <View style={styles.circleIconBox}>
                        <Text style={styles.circleIconEmoji}>{circle.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.circleName}>{circle.name}</Text>
                        <Text style={styles.circleMeta}>
                          ${circle.monthlyPayout.toLocaleString()} payout •{" "}
                          {circle.members} members
                        </Text>
                        <Text style={styles.circleMetaSub}>
                          Next payout: {circle.nextPayoutDate} (position #
                          {circle.yourPosition})
                        </Text>
                      </View>
                    </View>
                    <Radio selected={isSel} size={24} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Transfer options (only if a circle is selected) */}
          {selectedCircleId && (
            <View style={styles.card}>
              <Text style={[styles.fieldLabel, { marginBottom: 12 }]}>
                WHEN YOU RECEIVE A PAYOUT
              </Text>

              {/* Transfer all */}
              <TouchableOpacity
                onPress={() => setTransferOption("all")}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: transferOption === "all" }}
                style={[
                  styles.optionRow,
                  transferOption === "all" && styles.optionRowSelected,
                ]}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.optionIconBox, { backgroundColor: GREEN }]}>
                    <Text style={styles.optionIconEmoji}>💯</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Transfer all</Text>
                    <Text style={styles.optionBody}>
                      100% of payout goes to this Goal
                    </Text>
                  </View>
                </View>
                <Radio selected={transferOption === "all"} />
              </TouchableOpacity>

              {/* Transfer percentage */}
              <TouchableOpacity
                onPress={() => setTransferOption("percent")}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: transferOption === "percent" }}
                style={[
                  styles.optionRow,
                  transferOption === "percent" && styles.optionRowSelected,
                ]}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[styles.optionIconBox, { backgroundColor: "#F59E0B" }]}
                  >
                    <Text style={styles.optionIconEmoji}>📊</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Transfer a percentage</Text>
                    <Text style={styles.optionBody}>
                      Split between Goal and Wallet
                    </Text>
                  </View>
                </View>
                <Radio selected={transferOption === "percent"} />
              </TouchableOpacity>

              {/* Percentage selector (if percent selected) */}
              {transferOption === "percent" && (
                <View style={styles.percentBox}>
                  <View style={styles.percentHeaderRow}>
                    <Text style={styles.percentHeaderLabel}>To Goal</Text>
                    <Text style={styles.percentHeaderValue}>
                      {transferPercent}%
                    </Text>
                  </View>

                  <View style={styles.percentButtonRow}>
                    {PERCENT_OPTIONS.map((pct) => {
                      const isActive = transferPercent === pct;
                      return (
                        <TouchableOpacity
                          key={pct}
                          onPress={() => setTransferPercent(pct)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isActive }}
                          style={[
                            styles.percentButton,
                            isActive && styles.percentButtonActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.percentButtonText,
                              isActive && styles.percentButtonTextActive,
                            ]}
                          >
                            {pct}%
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.percentSplitRow}>
                    <Text style={styles.percentSplitText}>
                      ${toGoal.toLocaleString()} → Goal
                    </Text>
                    <Text style={styles.percentSplitText}>
                      ${toWallet.toLocaleString()} → Wallet
                    </Text>
                  </View>
                </View>
              )}

              {/* Ask each time */}
              <TouchableOpacity
                onPress={() => setTransferOption("ask")}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: transferOption === "ask" }}
                style={[
                  styles.optionRow,
                  { marginBottom: 0 },
                  transferOption === "ask" && styles.optionRowSelected,
                ]}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.optionIconBox, { backgroundColor: MUTED }]}>
                    <Text style={styles.optionIconEmoji}>❓</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Ask me each time</Text>
                    <Text style={styles.optionBody}>
                      I'll decide when payout arrives
                    </Text>
                  </View>
                </View>
                <Radio selected={transferOption === "ask"} />
              </TouchableOpacity>
            </View>
          )}

          {/* Preview */}
          {selectedCircleId && (
            <LinearGradient
              colors={["#059669", "#047857"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.previewCard}
            >
              <Text style={styles.previewLabel}>WHAT HAPPENS NEXT</Text>
              <Text style={styles.previewBody}>
                {transferOption === "all" && (
                  <>
                    When <Text style={styles.previewBold}>{selectedCircle?.name}</Text>{" "}
                    pays out ${payout.toLocaleString()}, it will{" "}
                    <Text style={styles.previewBold}>
                      automatically transfer to {goal.name}
                    </Text>{" "}
                    and start earning 4% APY immediately.
                  </>
                )}
                {transferOption === "percent" && (
                  <>
                    When <Text style={styles.previewBold}>{selectedCircle?.name}</Text>{" "}
                    pays out ${payout.toLocaleString()},{" "}
                    <Text style={styles.previewBold}>
                      ${toGoal.toLocaleString()}
                    </Text>{" "}
                    goes to {goal.name} and{" "}
                    <Text style={styles.previewBold}>
                      ${toWallet.toLocaleString()}
                    </Text>{" "}
                    stays in your Wallet.
                  </>
                )}
                {transferOption === "ask" && (
                  <>
                    When <Text style={styles.previewBold}>{selectedCircle?.name}</Text>{" "}
                    pays out, we'll notify you and ask where you'd like to send the
                    funds.
                  </>
                )}
              </Text>
            </LinearGradient>
          )}
        </View>
      </ScrollView>

      {/* ===== BOTTOM CTA ===== */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={() => comingSoon("Link Circle to Goal")}
          disabled={!selectedCircleId}
          accessibilityRole="button"
          accessibilityState={{ disabled: !selectedCircleId }}
          style={[
            styles.primaryButton,
            !selectedCircleId && styles.primaryButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.primaryButtonText,
              !selectedCircleId && styles.primaryButtonTextDisabled,
            ]}
          >
            {selectedCircleId ? "Link Circle to Goal" : "Select a Circle"}
          </Text>
        </TouchableOpacity>

        {goal.linkedCircleId && (
          <TouchableOpacity
            onPress={() => comingSoon("Remove Current Link")}
            accessibilityRole="button"
            style={styles.removeButton}
          >
            <Text style={styles.removeText}>Remove Current Link</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: { paddingTop: 20, paddingBottom: 50, paddingHorizontal: 20 },
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

  goalSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
  },
  goalEmojiBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  goalEmoji: { fontSize: 26 },
  goalName: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  goalMeta: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 },

  contentWrap: { marginTop: -25, paddingHorizontal: 16 },

  explainCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  explainEmoji: { fontSize: 24 },
  explainTitle: { fontSize: 14, fontWeight: "600", color: "#1D4ED8" },
  explainBody: { fontSize: 13, color: "#1E40AF", lineHeight: 20, marginTop: 6 },
  explainBold: { fontWeight: "700", color: "#1E40AF" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: MUTED },

  // Circle selection
  circleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F5F7FA",
  },
  circleRowSelected: {
    borderWidth: 2,
    borderColor: TEAL,
    backgroundColor: "#F0FDFB",
    margin: -1,
  },
  circleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  circleIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  circleIconEmoji: { fontSize: 22 },
  circleName: { fontSize: 14, fontWeight: "600", color: NAVY },
  circleMeta: { fontSize: 12, color: MUTED, marginTop: 2 },
  circleMetaSub: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },

  // Transfer options
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  optionRowSelected: {
    borderWidth: 2,
    borderColor: TEAL,
    backgroundColor: "#F0FDFB",
    margin: -1,
    marginBottom: 9,
  },
  optionLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconEmoji: { fontSize: 18 },
  optionTitle: { fontSize: 14, fontWeight: "600", color: NAVY },
  optionBody: { fontSize: 12, color: MUTED, marginTop: 2 },

  // Percentage selector
  percentBox: {
    padding: 16,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    marginBottom: 10,
  },
  percentHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  percentHeaderLabel: { fontSize: 13, color: MUTED },
  percentHeaderValue: { fontSize: 15, fontWeight: "700", color: GREEN },
  percentButtonRow: { flexDirection: "row", gap: 8 },
  percentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  percentButtonActive: {
    borderWidth: 2,
    borderColor: TEAL,
    backgroundColor: "#F0FDFB",
  },
  percentButtonText: { fontSize: 13, fontWeight: "600", color: MUTED },
  percentButtonTextActive: { color: GREEN },
  percentSplitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  percentSplitText: { fontSize: 12, color: MUTED },

  // Preview
  previewCard: { borderRadius: 14, padding: 16 },
  previewLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 10,
  },
  previewBody: { fontSize: 14, color: "#FFFFFF", lineHeight: 22 },
  previewBold: { fontWeight: "700", color: "#FFFFFF" },

  // Bottom CTA
  bottomBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  primaryButtonDisabled: { backgroundColor: BORDER },
  primaryButtonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  primaryButtonTextDisabled: { color: "#9CA3AF" },
  removeButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  removeText: { fontSize: 14, fontWeight: "600", color: RED },
});
