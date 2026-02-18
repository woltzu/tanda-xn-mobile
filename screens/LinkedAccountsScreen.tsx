import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type LinkedAccountsNavigationProp = StackNavigationProp<RootStackParamList>;

interface LinkedAccount {
  id: string;
  type: "bank" | "card";
  name: string;
  last4: string;
  logo: string;
  isPrimary: boolean;
  verified: boolean;
}

export default function LinkedAccountsScreen() {
  const navigation = useNavigation<LinkedAccountsNavigationProp>();

  const [accounts] = useState<LinkedAccount[]>([
    {
      id: "1",
      type: "bank",
      name: "Chase Checking",
      last4: "4521",
      logo: "business",
      isPrimary: true,
      verified: true,
    },
    {
      id: "2",
      type: "bank",
      name: "Bank of America",
      last4: "8734",
      logo: "business",
      isPrimary: false,
      verified: true,
    },
    {
      id: "3",
      type: "card",
      name: "Visa",
      last4: "9876",
      logo: "card",
      isPrimary: false,
      verified: true,
    },
  ]);

  const handleAddBank = () => {
    Alert.alert(
      "Link Bank Account",
      "You'll be securely connected to your bank through Plaid.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => console.log("Open Plaid") },
      ]
    );
  };

  const handleAddCard = () => {
    Alert.alert(
      "Add Debit Card",
      "Add a debit card for instant transfers.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => console.log("Open card form") },
      ]
    );
  };

  const handleSetPrimary = (accountId: string) => {
    Alert.alert(
      "Set as Primary",
      "This account will be used for automatic payments and payouts.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => console.log("Set primary:", accountId) },
      ]
    );
  };

  const handleRemoveAccount = (account: LinkedAccount) => {
    Alert.alert(
      "Remove Account",
      `Are you sure you want to remove ${account.name} (****${account.last4})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => console.log("Remove:", account.id),
        },
      ]
    );
  };

  const bankAccounts = accounts.filter((a) => a.type === "bank");
  const cardAccounts = accounts.filter((a) => a.type === "card");

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
                {bankAccounts.map((account, index) => (
                  <View
                    key={account.id}
                    style={[
                      styles.accountItem,
                      index < bankAccounts.length - 1 && styles.borderBottom,
                    ]}
                  >
                    <View style={styles.accountIcon}>
                      <Ionicons name="business" size={24} color="#0A2342" />
                    </View>
                    <View style={styles.accountContent}>
                      <View style={styles.accountTitleRow}>
                        <Text style={styles.accountName}>{account.name}</Text>
                        {account.isPrimary && (
                          <View style={styles.primaryBadge}>
                            <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.accountNumber}>
                        ****{account.last4}
                      </Text>
                      {account.verified && (
                        <View style={styles.verifiedRow}>
                          <Ionicons
                            name="shield-checkmark"
                            size={12}
                            color="#00C6AE"
                          />
                          <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.moreButton}
                      onPress={() => {
                        Alert.alert(
                          account.name,
                          `****${account.last4}`,
                          [
                            { text: "Cancel", style: "cancel" },
                            !account.isPrimary && {
                              text: "Set as Primary",
                              onPress: () => handleSetPrimary(account.id),
                            },
                            {
                              text: "Remove",
                              style: "destructive",
                              onPress: () => handleRemoveAccount(account),
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

          {/* Debit Cards */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Debit Cards</Text>
              <TouchableOpacity style={styles.addButton} onPress={handleAddCard}>
                <Ionicons name="add" size={18} color="#00C6AE" />
                <Text style={styles.addButtonText}>Add Card</Text>
              </TouchableOpacity>
            </View>

            {cardAccounts.length > 0 ? (
              <View style={styles.card}>
                {cardAccounts.map((account, index) => (
                  <View
                    key={account.id}
                    style={[
                      styles.accountItem,
                      index < cardAccounts.length - 1 && styles.borderBottom,
                    ]}
                  >
                    <View style={[styles.accountIcon, { backgroundColor: "#EFF6FF" }]}>
                      <Ionicons name="card" size={24} color="#3B82F6" />
                    </View>
                    <View style={styles.accountContent}>
                      <View style={styles.accountTitleRow}>
                        <Text style={styles.accountName}>{account.name}</Text>
                      </View>
                      <Text style={styles.accountNumber}>
                        ****{account.last4}
                      </Text>
                      {account.verified && (
                        <View style={styles.verifiedRow}>
                          <Ionicons
                            name="shield-checkmark"
                            size={12}
                            color="#00C6AE"
                          />
                          <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.moreButton}
                      onPress={() => {
                        Alert.alert(
                          account.name,
                          `****${account.last4}`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Remove",
                              style: "destructive",
                              onPress: () => handleRemoveAccount(account),
                            },
                          ]
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
