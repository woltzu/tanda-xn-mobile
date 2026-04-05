import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { usePayment, SavedPaymentMethod } from "../context/PaymentContext";

type LinkedAccountsNavigationProp = StackNavigationProp<RootStackParamList>;

export default function LinkedAccountsScreen() {
  const navigation = useNavigation<LinkedAccountsNavigationProp>();
  const {
    paymentMethods,
    isLoadingMethods,
    isOnboarded,
    setupConnectedAccount,
    removePaymentMethod,
    setDefaultPaymentMethod,
    refreshPaymentMethods,
  } = usePayment();

  const bankAccounts = paymentMethods.filter((m) => m.type === "us_bank_account");
  const cardAccounts = paymentMethods.filter((m) => m.type !== "us_bank_account");

  const handleAddBank = async () => {
    try {
      const onboardingUrl = await setupConnectedAccount("tandaxn://linked-accounts");
      if (onboardingUrl) {
        await Linking.openURL(onboardingUrl);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to start bank account setup.");
    }
  };

  const handleAddCard = () => {
    Alert.alert(
      "Add Card",
      "Card collection coming soon \u2014 use Add Funds to save a card.",
      [{ text: "OK" }]
    );
  };

  const handleSetPrimary = (method: SavedPaymentMethod) => {
    Alert.alert(
      "Set as Primary",
      `Use ${method.label} for automatic payments and payouts?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await setDefaultPaymentMethod(method.id);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to set default payment method.");
            }
          },
        },
      ]
    );
  };

  const handleRemoveAccount = (method: SavedPaymentMethod) => {
    Alert.alert(
      "Remove Account",
      `Are you sure you want to remove ${method.label}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removePaymentMethod(method.id);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to remove payment method.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Linked Accounts</Text>
              <Text style={styles.headerSubtitle}>
                Manage your payment methods
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Onboarding Banner */}
          {!isOnboarded && (
            <TouchableOpacity style={styles.onboardingBanner} onPress={handleAddBank}>
              <View style={styles.onboardingIcon}>
                <Ionicons name="warning" size={20} color="#F59E0B" />
              </View>
              <View style={styles.onboardingContent}>
                <Text style={styles.onboardingTitle}>
                  Complete Account Setup
                </Text>
                <Text style={styles.onboardingText}>
                  Finish Stripe onboarding to enable payouts and bank transfers.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>
          )}

          {/* Loading State */}
          {isLoadingMethods ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00C6AE" />
              <Text style={styles.loadingText}>Loading payment methods...</Text>
            </View>
          ) : (
            <>
              {/* Bank Accounts */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Bank Accounts</Text>
                  <TouchableOpacity style={styles.addButton} onPress={handleAddBank}>
                    <Ionicons name="add" size={18} color="#00C6AE" />
                    <Text style={styles.addButtonText}>Add Bank</Text>
                  </TouchableOpacity>
                </View>

                {bankAccounts.length > 0 ? (
                  <View style={styles.card}>
                    {bankAccounts.map((method, index) => (
                      <View
                        key={method.id}
                        style={[
                          styles.accountItem,
                          index < bankAccounts.length - 1 && styles.borderBottom,
                        ]}
                      >
                        <View style={styles.accountIcon}>
                          <Ionicons
                            name={method.icon as any}
                            size={24}
                            color="#0A2342"
                          />
                        </View>
                        <View style={styles.accountContent}>
                          <View style={styles.accountTitleRow}>
                            <Text style={styles.accountName}>{method.label}</Text>
                            {method.isDefault && (
                              <View style={styles.primaryBadge}>
                                <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                              </View>
                            )}
                          </View>
                          {method.bankLast4 && (
                            <Text style={styles.accountNumber}>
                              ****{method.bankLast4}
                            </Text>
                          )}
                          <View style={styles.verifiedRow}>
                            <Ionicons
                              name="shield-checkmark"
                              size={12}
                              color="#00C6AE"
                            />
                            <Text style={styles.verifiedText}>Verified</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.moreButton}
                          onPress={() => {
                            Alert.alert(
                              method.label,
                              method.bankLast4 ? `****${method.bankLast4}` : undefined,
                              [
                                { text: "Cancel", style: "cancel" },
                                !method.isDefault
                                  ? {
                                      text: "Set as Primary",
                                      onPress: () => handleSetPrimary(method),
                                    }
                                  : null,
                                {
                                  text: "Remove",
                                  style: "destructive",
                                  onPress: () => handleRemoveAccount(method),
                                },
                              ].filter(Boolean) as any
                            );
                          }}
                        >
                          <Ionicons
                            name="ellipsis-vertical"
                            size={18}
                            color="#6B7280"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Ionicons name="business-outline" size={40} color="#9CA3AF" />
                    <Text style={styles.emptyText}>No bank accounts linked</Text>
                    <TouchableOpacity
                      style={styles.emptyButton}
                      onPress={handleAddBank}
                    >
                      <Text style={styles.emptyButtonText}>Link a Bank</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Cards & Other Methods */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Cards & Other</Text>
                  <TouchableOpacity style={styles.addButton} onPress={handleAddCard}>
                    <Ionicons name="add" size={18} color="#00C6AE" />
                    <Text style={styles.addButtonText}>Add Card</Text>
                  </TouchableOpacity>
                </View>

                {cardAccounts.length > 0 ? (
                  <View style={styles.card}>
                    {cardAccounts.map((method, index) => (
                      <View
                        key={method.id}
                        style={[
                          styles.accountItem,
                          index < cardAccounts.length - 1 && styles.borderBottom,
                        ]}
                      >
                        <View style={[styles.accountIcon, { backgroundColor: "#EFF6FF" }]}>
                          <Ionicons
                            name={method.icon as any}
                            size={24}
                            color="#3B82F6"
                          />
                        </View>
                        <View style={styles.accountContent}>
                          <View style={styles.accountTitleRow}>
                            <Text style={styles.accountName}>{method.label}</Text>
                            {method.isDefault && (
                              <View style={styles.primaryBadge}>
                                <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                              </View>
                            )}
                          </View>
                          {method.cardLast4 && (
                            <Text style={styles.accountNumber}>
                              ****{method.cardLast4}
                            </Text>
                          )}
                          <View style={styles.verifiedRow}>
                            <Ionicons
                              name="shield-checkmark"
                              size={12}
                              color="#00C6AE"
                            />
                            <Text style={styles.verifiedText}>Verified</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.moreButton}
                          onPress={() => {
                            Alert.alert(
                              method.label,
                              method.cardLast4 ? `****${method.cardLast4}` : undefined,
                              [
                                { text: "Cancel", style: "cancel" },
                                !method.isDefault
                                  ? {
                                      text: "Set as Primary",
                                      onPress: () => handleSetPrimary(method),
                                    }
                                  : null,
                                {
                                  text: "Remove",
                                  style: "destructive",
                                  onPress: () => handleRemoveAccount(method),
                                },
                              ].filter(Boolean) as any
                            );
                          }}
                        >
                          <Ionicons
                            name="ellipsis-vertical"
                            size={18}
                            color="#6B7280"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Ionicons name="card-outline" size={40} color="#9CA3AF" />
                    <Text style={styles.emptyText}>No cards added</Text>
                    <TouchableOpacity
                      style={styles.emptyButton}
                      onPress={handleAddCard}
                    >
                      <Text style={styles.emptyButtonText}>Add a Card</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Security Note */}
          <View style={styles.securityCard}>
            <View style={styles.securityIcon}>
              <Ionicons name="lock-closed" size={20} color="#00897B" />
            </View>
            <View style={styles.securityContent}>
              <Text style={styles.securityTitle}>Bank-Level Security</Text>
              <Text style={styles.securityText}>
                Your financial data is encrypted and securely stored. We never
                store your bank login credentials.
              </Text>
            </View>
          </View>

          {/* Info Note */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color="#3B82F6" />
            <Text style={styles.infoText}>
              Link your bank account for free ACH transfers. Debit cards enable
              instant transfers with a small fee.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
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
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  onboardingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  onboardingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(245,158,11,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  onboardingContent: {
    flex: 1,
  },
  onboardingTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 2,
  },
  onboardingText: {
    fontSize: 12,
    color: "#A16207",
    lineHeight: 17,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  accountContent: {
    flex: 1,
  },
  accountTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accountName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  primaryBadge: {
    backgroundColor: "#F0FDFB",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#00C6AE",
  },
  accountNumber: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 11,
    color: "#00C6AE",
    fontWeight: "500",
  },
  moreButton: {
    padding: 8,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 10,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: "#F0FDFB",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  securityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  securityIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00897B",
    marginBottom: 4,
  },
  securityText: {
    fontSize: 12,
    color: "#065F46",
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: "#1E40AF",
    lineHeight: 18,
  },
});
