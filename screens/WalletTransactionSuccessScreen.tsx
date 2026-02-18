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
import { useNavigation, useRoute, RouteProp, CommonActions } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type WalletTransactionSuccessNavigationProp = StackNavigationProp<RootStackParamList>;
type WalletTransactionSuccessRouteProp = RouteProp<RootStackParamList, "WalletTransactionSuccess">;

export default function WalletTransactionSuccessScreen() {
  const navigation = useNavigation<WalletTransactionSuccessNavigationProp>();
  const route = useRoute<WalletTransactionSuccessRouteProp>();
  const { type, amount, method, recipientName, transactionId } = route.params;

  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
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
    switch (type) {
      case "add":
        return `$${amount.toFixed(2)} has been added to your wallet`;
      case "withdraw":
        return `$${amount.toFixed(2)} is on its way to your ${method}`;
      case "send":
        return `$${amount.toFixed(2)} has been sent to ${recipientName}`;
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
        message: `TandaXn Transaction Receipt\n\n${getTitle()}\nAmount: $${amount.toFixed(2)}\nMethod: ${method}\n${recipientName ? `Recipient: ${recipientName}\n` : ""}Transaction ID: ${transactionId}\nDate: ${formatDate()}\n\nPowered by TandaXn`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleBackToWallet = () => {
    // Navigate to MainTabs and then to the Wallet tab
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: "MainTabs",
            state: {
              routes: [
                { name: "Home" },
                { name: "Wallet" },
                { name: "Circles" },
                { name: "Profile" },
              ],
              index: 1, // Index 1 is Wallet tab
            },
          },
        ],
      })
    );
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
            <Text style={styles.detailsTitle}>Transaction Details</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.detailValue}>${amount.toFixed(2)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Method</Text>
              <Text style={styles.detailValue}>{method}</Text>
            </View>

            {recipientName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Recipient</Text>
                <Text style={styles.detailValue}>{recipientName}</Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Transaction ID</Text>
              <Text style={styles.detailValueSmall}>{transactionId}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValueSmall}>{formatDate()}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
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
                <Text style={styles.shareButtonPrimaryText}>Share Receipt</Text>
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
            <Text style={styles.backToWalletText}>Back to Wallet</Text>
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
