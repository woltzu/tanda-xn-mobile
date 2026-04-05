"use client";

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTokens } from "@/context/TokenContext";

// ══════════════════════════════════════════════════════════════════════════════
// ELDER-022 — Redeem Tokens
// Spend TXN tokens on fee discounts, priority placement, and more
// ══════════════════════════════════════════════════════════════════════════════

export default function RedeemTokensScreen() {
  const router = useRouter();
  const {
    balance,
    balanceUsd,
    isLoading,
    refreshBalance,
    redeemTokens,
    calculateTokenDiscount,
    formatTokenAmount,
    currentRate,
  } = useTokens();

  const [refreshing, setRefreshing] = useState(false);
  const [feeDiscountAmount, setFeeDiscountAmount] = useState("");
  const [redeemingType, setRedeemingType] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshBalance();
    } finally {
      setRefreshing(false);
    }
  }, [refreshBalance]);

  // Computed discount preview
  const tokensForDiscount = parseInt(feeDiscountAmount, 10) || 0;
  const discountUsd =
    currentRate && tokensForDiscount > 0
      ? Math.min(tokensForDiscount, balance) * currentRate.tokenValueUsd
      : 0;

  // ── Redemption Handlers ──

  const confirmAndRedeem = (
    type: "fee_discount" | "priority_placement",
    amount: number,
    description: string
  ) => {
    if (amount > balance) {
      Alert.alert(
        "Insufficient Balance",
        `You need ${amount.toLocaleString()} TXN but only have ${balance.toLocaleString()} TXN.`
      );
      return;
    }

    Alert.alert(
      "Confirm Redemption",
      `Spend ${amount.toLocaleString()} TXN on ${description}?\n\nYour balance will be ${(balance - amount).toLocaleString()} TXN after this.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "default",
          onPress: () => executeRedeem(type, amount, description),
        },
      ]
    );
  };

  const executeRedeem = async (
    type: "fee_discount" | "priority_placement",
    amount: number,
    description: string
  ) => {
    setRedeemingType(type);
    try {
      const result = await redeemTokens({ type, amount, description });
      if (result.success) {
        setSuccessMessage(result.message);
        setFeeDiscountAmount("");
        // Auto-dismiss success after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        Alert.alert("Redemption Failed", result.message);
      }
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setRedeemingType(null);
    }
  };

  const handleFeeDiscount = () => {
    const amount = tokensForDiscount;
    if (amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid number of tokens.");
      return;
    }
    const actualAmount = Math.min(amount, balance);
    confirmAndRedeem(
      "fee_discount",
      actualAmount,
      `Fee discount ($${(actualAmount * (currentRate?.tokenValueUsd || 0)).toFixed(2)} off)`
    );
  };

  const handlePriorityPlacement = () => {
    confirmAndRedeem(
      "priority_placement",
      50,
      "Priority placement in circle matching"
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Navy Gradient Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Redeem Tokens</Text>
            <Text style={styles.headerSubtitle}>
              Use your TXN tokens for rewards
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0A2342"
            colors={["#0A2342"]}
          />
        }
      >
        {/* ── Success Banner ── */}
        {successMessage && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}

        {/* ── Compact Balance Card ── */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceLeft}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>
              {balance.toLocaleString()}{" "}
              <Text style={styles.balanceTxn}>TXN</Text>
            </Text>
            <Text style={styles.balanceUsd}>
              {"\u2248"} ${balanceUsd.toFixed(2)} USD
            </Text>
          </View>
          <View style={styles.balanceIconWrap}>
            <Ionicons name="wallet-outline" size={28} color="#10B981" />
          </View>
        </View>

        {/* ── Option 1: Fee Discount ── */}
        <View style={styles.optionCard}>
          <View style={styles.optionHeader}>
            <View style={styles.optionIconWrap}>
              <Ionicons name="pricetag-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.optionHeaderText}>
              <Text style={styles.optionTitle}>Fee Discount</Text>
              <Text style={styles.optionSubtitle}>
                Apply tokens to reduce circle fees
              </Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Tokens to use</Text>
            <TextInput
              style={styles.tokenInput}
              value={feeDiscountAmount}
              onChangeText={(text) =>
                setFeeDiscountAmount(text.replace(/[^0-9]/g, ""))
              }
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={8}
            />
          </View>

          {tokensForDiscount > 0 && (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Discount amount:</Text>
              <Text style={styles.previewValue}>${discountUsd.toFixed(2)}</Text>
            </View>
          )}

          {tokensForDiscount > balance && (
            <View style={styles.warningRow}>
              <Ionicons
                name="warning-outline"
                size={14}
                color="#F59E0B"
              />
              <Text style={styles.warningText}>
                Exceeds balance. Will use {balance.toLocaleString()} TXN.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.redeemBtn,
              tokensForDiscount <= 0 && styles.redeemBtnDisabled,
            ]}
            onPress={handleFeeDiscount}
            disabled={tokensForDiscount <= 0 || redeemingType === "fee_discount"}
          >
            {redeemingType === "fee_discount" ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.redeemBtnText,
                  tokensForDiscount <= 0 && styles.redeemBtnTextDisabled,
                ]}
              >
                Apply Discount
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Option 2: Priority Placement ── */}
        <View style={styles.optionCard}>
          <View style={styles.optionHeader}>
            <View
              style={[styles.optionIconWrap, { backgroundColor: "#6366F1" }]}
            >
              <Ionicons name="rocket-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.optionHeaderText}>
              <Text style={styles.optionTitle}>Priority Placement</Text>
              <Text style={styles.optionSubtitle}>
                Get priority in circle matching
              </Text>
            </View>
          </View>

          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Cost:</Text>
            <Text style={styles.costValue}>50 TXN</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.redeemBtn,
              balance < 50 && styles.redeemBtnDisabled,
            ]}
            onPress={handlePriorityPlacement}
            disabled={
              balance < 50 || redeemingType === "priority_placement"
            }
          >
            {redeemingType === "priority_placement" ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.redeemBtnText,
                  balance < 50 && styles.redeemBtnTextDisabled,
                ]}
              >
                Use 50 Tokens
              </Text>
            )}
          </TouchableOpacity>

          {balance < 50 && (
            <Text style={styles.insufficientNote}>
              You need {(50 - balance).toLocaleString()} more TXN
            </Text>
          )}
        </View>

        {/* ── Option 3: Merchandise (Coming Soon) ── */}
        <View style={[styles.optionCard, styles.optionCardDisabled]}>
          <View style={styles.optionHeader}>
            <View
              style={[styles.optionIconWrap, { backgroundColor: "#9CA3AF" }]}
            >
              <Ionicons name="gift-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.optionHeaderText}>
              <Text style={[styles.optionTitle, { color: "#9CA3AF" }]}>
                Merchandise
              </Text>
              <Text style={styles.optionSubtitle}>
                TandaXn branded items
              </Text>
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            </View>
          </View>
        </View>

        {/* ── Option 4: Withdrawal (Coming Soon) ── */}
        <View style={[styles.optionCard, styles.optionCardDisabled]}>
          <View style={styles.optionHeader}>
            <View
              style={[styles.optionIconWrap, { backgroundColor: "#9CA3AF" }]}
            >
              <Ionicons name="cash-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.optionHeaderText}>
              <Text style={[styles.optionTitle, { color: "#9CA3AF" }]}>
                Withdrawal
              </Text>
              <Text style={styles.optionSubtitle}>Convert to cash</Text>
            </View>
            <View style={[styles.comingSoonBadge, styles.pendingBadge]}>
              <Text style={[styles.comingSoonText, styles.pendingText]}>
                Coming Soon {"\u2014"} Pending Legal Review
              </Text>
            </View>
          </View>
        </View>

        {/* ── Info Note ── */}
        <View style={styles.infoNote}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#6B7280"
          />
          <Text style={styles.infoNoteText}>
            Token redemptions are processed instantly. Fee discounts are
            applied to your next circle payment. Priority placement lasts for
            one matching cycle.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },

  // ── Header ──
  header: {
    backgroundColor: "#0A2342",
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },

  // ── ScrollView ──
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },

  // ── Success Banner ──
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  successText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#065F46",
  },

  // ── Balance Card (compact) ──
  balanceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#0A2342",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  balanceLeft: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0A2342",
    marginTop: 2,
  },
  balanceTxn: {
    fontSize: 16,
    fontWeight: "600",
    color: "#10B981",
  },
  balanceUsd: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 2,
  },
  balanceIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(16,185,129,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Option Card ──
  optionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    shadowColor: "#0A2342",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  optionCardDisabled: {
    opacity: 0.6,
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  optionHeaderText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
  },
  optionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },

  // ── Input ──
  inputRow: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 6,
  },
  tokenInput: {
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  // ── Preview ──
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 4,
  },
  previewLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  previewValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },

  // ── Warning ──
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  warningText: {
    fontSize: 12,
    color: "#F59E0B",
  },

  // ── Cost Row ──
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  costLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  costValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },

  // ── Redeem Button ──
  redeemBtn: {
    marginTop: 16,
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  redeemBtnDisabled: {
    backgroundColor: "#E5E7EB",
  },
  redeemBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  redeemBtnTextDisabled: {
    color: "#9CA3AF",
  },
  insufficientNote: {
    textAlign: "center",
    fontSize: 12,
    color: "#EF4444",
    marginTop: 8,
  },

  // ── Coming Soon Badge ──
  comingSoonBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },
  pendingBadge: {
    backgroundColor: "#FEF3C7",
  },
  pendingText: {
    color: "#D97706",
    fontSize: 10,
  },

  // ── Info Note ──
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
});
