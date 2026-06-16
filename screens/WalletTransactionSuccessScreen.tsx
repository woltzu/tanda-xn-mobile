import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type WalletTransactionSuccessNavigationProp = StackNavigationProp<RootStackParamList>;
type WalletTransactionSuccessRouteProp = RouteProp<RootStackParamList, "WalletTransactionSuccess">;

export default function WalletTransactionSuccessScreen() {
  const navigation = useNavigation<WalletTransactionSuccessNavigationProp>();
  const route = useRoute<WalletTransactionSuccessRouteProp>();
  const {
    type,
    amount,
    method,
    recipientName,
    transactionId,
    currency,
    convertedAmount,
    convertedCurrency,
    feeAmount,
    feeCurrency,
  } = route.params;
  const displayCurrency = currency || "USD";
  // Fee defaults to source currency when not specified explicitly. Most
  // sends pay the fee out of the same currency they debit.
  const feeDisplayCurrency = feeCurrency || displayCurrency;
  const hasFee = typeof feeAmount === "number" && feeAmount > 0;
  // Total debited only makes sense when both amount and fee are in the
  // same currency — otherwise we'd be summing apples and oranges. The
  // current Send flows always satisfy this; the guard is defensive.
  const showTotalDebited = hasFee && feeDisplayCurrency === displayCurrency;
  const totalDebited = hasFee ? amount + (feeAmount as number) : amount;

  // Currency-aware money formatter. Intl.NumberFormat handles symbol +
  // decimal-place rules for every ISO 4217 code — no per-currency table.
  // Accepts an explicit currency arg so it works for both source amounts
  // and the cross-border secondary line.
  const formatMoney = (value: number, code?: string): string => {
    const cur = code || displayCurrency;
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: cur,
      }).format(value);
    } catch {
      // Defensive: if a caller passed a bogus currency code, fall back to
      // a plain number with the code as a prefix.
      return `${cur} ${value.toFixed(2)}`;
    }
  };

  // Cross-border display: the converted-amount line only renders when the
  // caller actually passed both fields AND the target currency differs
  // from the source (a USA→USA send should NOT show "≈ $1.00").
  const showConverted =
    typeof convertedAmount === "number" &&
    !!convertedCurrency &&
    convertedCurrency !== displayCurrency &&
    convertedAmount > 0;

  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Success animation sequence
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const getTitle = () => {
    switch (type) {
      case "add":
        return "Funds Added!";
      case "withdraw":
        return "Withdrawal Initiated!";
      case "send":
        return "Money Sent!";
      default:
        return "Success!";
    }
  };

  const getSubtitle = () => {
    const money = formatMoney(amount);
    switch (type) {
      case "add":
        return `${money} has been added to your wallet`;
      case "withdraw":
        return `${money} is on its way to your ${method}`;
      case "send":
        return `${money} has been sent to ${recipientName}`;
      default:
        return "Transaction completed successfully";
    }
  };

  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case "add":
        return "add-circle";
      case "withdraw":
        return "arrow-up-circle";
      case "send":
        return "send";
      default:
        return "checkmark-circle";
    }
  };

  const getGradientColors = (): [string, string] => {
    switch (type) {
      case "add":
        return ["#00C6AE", "#00A896"];
      case "withdraw":
        return ["#1565C0", "#0D47A1"];
      case "send":
        return ["#00C6AE", "#00A896"];
      default:
        return ["#00C6AE", "#00A896"];
    }
  };

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleShareReceipt = async () => {
    try {
      await Share.share({
        message: `TandaXn Transaction Receipt\n\n${getTitle()}\nAmount: ${formatMoney(amount)}\nMethod: ${method}\n${recipientName ? `Recipient: ${recipientName}\n` : ""}Transaction ID: ${transactionId}\nDate: ${formatDate()}\n\nPowered by TandaXn`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  // Reset to MainTabs — the active tab navigator (Home / Circles / Action /
  // Market / Community) has no dedicated "Wallet" tab; the wallet surface
  // lives inside Home. Dropping the user on Home is therefore the correct
  // "back to where the balance lives" target.
  const handleBackToWallet = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs" }],
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.background}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Success Animation */}
          <Animated.View
            style={[
              styles.successIconContainer,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <LinearGradient
              colors={getGradientColors()}
              style={styles.successIconGradient}
            >
              <Ionicons name={getIconName()} size={48} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          {/* Success Message */}
          <Animated.View
            style={[
              styles.messageContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.successTitle}>{getTitle()}</Text>
            <Text style={styles.successSubtitle}>{getSubtitle()}</Text>
            {showConverted && (
              <Text style={styles.convertedLine}>
                {t("final_polish.wallettransactionsuccess_converted_approx", {
                  amount: formatMoney(convertedAmount!, convertedCurrency!),
                  defaultValue: `≈ ${formatMoney(convertedAmount!, convertedCurrency!)}`,
                })}
              </Text>
            )}
          </Animated.View>

          {/* Transaction Details Card */}
          <Animated.View
            style={[
              styles.detailsCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.detailsTitle}>{t("final_polish.wallettransactionsuccess_transaction_details")}</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("final_polish.wallettransactionsuccess_amount")}</Text>
              <Text style={styles.detailValue}>{formatMoney(amount)}</Text>
            </View>

            {hasFee && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {t("final_polish.wallettransactionsuccess_fee", {
                    defaultValue: "Fee",
                  })}
                </Text>
                <Text style={styles.detailValue}>
                  {formatMoney(feeAmount as number, feeDisplayCurrency)}
                </Text>
              </View>
            )}

            {showTotalDebited && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, styles.detailLabelBold]}>
                  {t("final_polish.wallettransactionsuccess_total_debited", {
                    defaultValue: "Total debited",
                  })}
                </Text>
                <Text style={[styles.detailValue, styles.detailValueBold]}>
                  {formatMoney(totalDebited)}
                </Text>
              </View>
            )}

            {showConverted && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {t("final_polish.wallettransactionsuccess_recipient_receives", {
                    defaultValue: "Recipient receives",
                  })}
                </Text>
                <Text style={styles.detailValue}>
                  {formatMoney(convertedAmount!, convertedCurrency!)}
                </Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("final_polish.wallettransactionsuccess_method")}</Text>
              <Text style={styles.detailValue}>{method}</Text>
            </View>

            {recipientName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("final_polish.wallettransactionsuccess_recipient")}</Text>
                <Text style={styles.detailValue}>{recipientName}</Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("final_polish.wallettransactionsuccess_transaction_id")}</Text>
              <Text style={styles.detailValueSmall}>{transactionId}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValueSmall}>{formatDate()}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("final_polish.wallettransactionsuccess_status")}</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>
                  {type === "withdraw" ? "Processing" : "Completed"}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Processing Notice for Withdrawals */}
          {type === "withdraw" && (
            <Animated.View
              style={[
                styles.noticeCard,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Ionicons name="time-outline" size={20} color="#1565C0" />
              <Text style={styles.noticeText}>
                Your withdrawal is being processed. You'll receive a notification once it's complete.
              </Text>
            </Animated.View>
          )}

          {/* Share Receipt Section */}
          <Animated.View
            style={[
              styles.shareSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.shareTitle}>Share with {recipientName ? recipientName.split(" ")[0] : "recipient"}</Text>
            <Text style={styles.shareSubtitle}>
              Send proof that your payment was successful
            </Text>
            <View style={styles.shareButtons}>
              <TouchableOpacity
                style={styles.shareButtonPrimary}
                onPress={handleShareReceipt}
              >
                <Ionicons name="share-social" size={20} color="#FFFFFF" />
                <Text style={styles.shareButtonPrimaryText}>{t("final_polish.wallettransactionsuccess_share_receipt")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareButtonSecondary}
                onPress={handleShareReceipt}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.backToWalletButton}
            onPress={handleBackToWallet}
          >
            <Ionicons name="wallet-outline" size={20} color="#FFFFFF" />
            <Text style={styles.backToWalletText}>{t("final_polish.wallettransactionsuccess_back_to_wallet")}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 100,
    paddingHorizontal: 20,
    paddingBottom: 140,
    alignItems: "center",
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00C6AE",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  messageContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  convertedLine: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    marginTop: 6,
    fontStyle: "italic",
  },
  detailsCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  // Visual emphasis on the "Total debited" row — it's the number the user
  // will want to reconcile against their wallet balance change.
  detailLabelBold: {
    fontWeight: "700",
    color: "#0A2342",
  },
  detailValueBold: {
    fontWeight: "800",
    fontSize: 15,
  },
  detailValueSmall: {
    fontSize: 12,
    fontWeight: "500",
    color: "#0A2342",
    textAlign: "right",
    maxWidth: "60%",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDFB",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00C6AE",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
  },
  noticeCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: "#1565C0",
    lineHeight: 18,
  },
  shareSection: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  shareSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 16,
    textAlign: "center",
  },
  shareButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  shareButtonPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  shareButtonPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  shareButtonSecondary: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: "rgba(10,35,66,0.95)",
  },
  backToWalletButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  backToWalletText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
