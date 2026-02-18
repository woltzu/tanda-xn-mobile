import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useWallet } from "../context/WalletContext";

type NavProp = StackNavigationProp<RootStackParamList>;

// =============================================================================
// TYPES & DATA
// =============================================================================

type RecentRecipient = {
  id: string;
  name: string;
  method: string;
  identifier: string;
  bank?: string;
  accountNumber?: string;
  network?: string;
  phone?: string;
  location?: string;
  verified?: boolean;
};

type MethodOption = {
  id: string;
  name: string;
  fee: number;
  estimate: string;
  icon: string;
  description: string;
  badge?: string;
};

const RECENT_RECIPIENTS: RecentRecipient[] = [
  { id: "r1", name: "Adekunle Gold", method: "wallet", identifier: "@adegold", verified: true },
  { id: "r2", name: "Funke Akindele", method: "bank", identifier: "GTBank \u2022\u2022\u2022\u20221234", bank: "GTBank", accountNumber: "0123456789" },
  { id: "r3", name: "Wizkid", method: "cash", identifier: "Ikeja", location: "Ikeja" },
  { id: "r4", name: "Davido", method: "mobile", identifier: "MTN \u2022\u2022\u2022\u20225678", network: "MTN", phone: "08012345678" },
];

const BANKS = [
  { id: "access", name: "Access Bank" },
  { id: "gtbank", name: "GTBank" },
  { id: "uba", name: "UBA" },
  { id: "firstbank", name: "First Bank" },
  { id: "zenith", name: "Zenith Bank" },
  { id: "fidelity", name: "Fidelity Bank" },
  { id: "union", name: "Union Bank" },
  { id: "stanbic", name: "Stanbic IBTC" },
];

const MOBILE_NETWORKS = [
  { id: "mtn", name: "MTN", color: "#FFCC00" },
  { id: "glo", name: "Glo", color: "#00A651" },
  { id: "airtel", name: "Airtel", color: "#ED1C24" },
  { id: "9mobile", name: "9mobile", color: "#006B53" },
];

const PICKUP_LOCATIONS = [
  { id: "ikeja", name: "Ikeja", address: "123 Allen Avenue" },
  { id: "vi", name: "Victoria Island", address: "45 Adeola Odeku" },
  { id: "lekki", name: "Lekki", address: "10 Admiralty Way" },
  { id: "ajah", name: "Ajah", address: "Ajah Market Road" },
  { id: "yaba", name: "Yaba", address: "Herbert Macaulay Way" },
];

const METHOD_OPTIONS: Record<string, MethodOption> = {
  wallet: {
    id: "wallet",
    name: "TandaXn Wallet",
    fee: 0,
    estimate: "Instant",
    icon: "\u{1F4B0}",
    description: "Free to TandaXn users",
    badge: "FREE",
  },
  bank: {
    id: "bank",
    name: "Bank Transfer",
    fee: 100,
    estimate: "Within minutes",
    icon: "\u{1F3E6}",
    description: "Any Nigerian bank",
  },
  mobile: {
    id: "mobile",
    name: "Mobile Money",
    fee: 75,
    estimate: "Instant",
    icon: "\u{1F4F1}",
    description: "MTN, Glo, Airtel, 9mobile",
  },
  cash: {
    id: "cash",
    name: "Cash Pickup",
    fee: 200,
    estimate: "~15 minutes",
    icon: "\u{1F4B5}",
    description: "Pickup at agent",
  },
};

const CURRENCY_SYMBOL = "\u20A6";
const COUNTRY_FLAG = "\u{1F1F3}\u{1F1EC}";

// =============================================================================
// COMPONENT
// =============================================================================

export default function DomesticSendMoneyScreen() {
  const navigation = useNavigation<NavProp>();
  const { balance, sendMoney } = useWallet();
  const userBalance = balance;

  // State
  const [recipientTab, setRecipientTab] = useState<"new" | "recent">("new");
  const [selectedRecipient, setSelectedRecipient] = useState<RecentRecipient | null>(null);
  const [selectedMethod, setSelectedMethod] = useState("wallet");
  const [recipientName, setRecipientName] = useState("");

  // Wallet fields
  const [walletLookup, setWalletLookup] = useState("");
  const [walletUserFound, setWalletUserFound] = useState<{ name: string; username: string; verified: boolean } | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Bank fields
  const [selectedBank, setSelectedBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [showBankPicker, setShowBankPicker] = useState(false);

  // Mobile fields
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Cash fields
  const [selectedLocation, setSelectedLocation] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Amount
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Derived
  const currentMethod = METHOD_OPTIONS[selectedMethod];
  const currentFee = currentMethod?.fee || 0;
  const numericAmount = parseFloat(amount) || 0;
  const totalToPay = numericAmount + currentFee;

  // Validation
  const validateAccountNumber = (value: string) => /^\d{10}$/.test(value);

  const validatePhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    return /^0\d{10}$/.test(cleaned) || /^234\d{10}$/.test(cleaned);
  };

  const isRecipientValid = () => {
    if (recipientTab === "recent" && selectedRecipient) return true;

    if (recipientTab === "new") {
      if (!recipientName || recipientName.length < 2) return false;

      switch (selectedMethod) {
        case "wallet":
          return walletUserFound !== null;
        case "bank":
          return selectedBank !== "" && validateAccountNumber(accountNumber);
        case "mobile":
          return selectedNetwork !== "" && validatePhoneNumber(phoneNumber);
        case "cash":
          return !!selectedLocation;
        default:
          return false;
      }
    }
    return false;
  };

  const isFormValid = () => {
    if (!isRecipientValid()) return false;
    if (numericAmount <= 0) return false;
    if (totalToPay > userBalance) return false;
    return true;
  };

  // Handlers
  const handleMethodChange = (method: string) => {
    setSelectedMethod(method);
    setWalletLookup("");
    setWalletUserFound(null);
    setSelectedBank("");
    setAccountNumber("");
    setSelectedNetwork("");
    setPhoneNumber("");
    setSelectedLocation("");
  };

  const handleSelectRecipient = (recipient: RecentRecipient) => {
    setSelectedRecipient(recipient);
    setSelectedMethod(recipient.method);
  };

  const handleWalletLookup = async (value: string) => {
    setWalletLookup(value);
    setWalletUserFound(null);

    if (value.length >= 3) {
      setIsLookingUp(true);
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (value.includes("@") || value.length >= 10) {
        setWalletUserFound({
          name: recipientName || "TandaXn User",
          username: value.startsWith("@") ? value : `@${value.replace(/\s/g, "").toLowerCase()}`,
          verified: true,
        });
      }
      setIsLookingUp(false);
    }
  };

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setAmount(cleaned);
  };

  const handleSend = async () => {
    if (!isFormValid()) return;

    setIsProcessing(true);
    try {
      const name = recipientTab === "recent" ? selectedRecipient?.name || "" : recipientName;
      const method = `Domestic - ${currentMethod?.name || ""}`;

      const txnId = await sendMoney(numericAmount, name, method, "NGN");

      navigation.navigate("WalletTransactionSuccess", {
        type: "send",
        amount: numericAmount,
        method,
        recipientName: name,
        transactionId: txnId || `TXN${Date.now()}`,
      });
    } catch (error) {
      Alert.alert("Transfer Failed", "Something went wrong. Please try again.");
      console.error("Error sending money:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex1}
      >
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <SafeAreaView>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>Send Money</Text>
                <Text style={styles.headerSubtitle}>{COUNTRY_FLAG} Domestic Transfer</Text>
              </View>
              <View style={styles.placeholder} />
            </View>

            {/* Balance */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceAmount}>
                {CURRENCY_SYMBOL}{formatCurrency(userBalance)}
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Content */}
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ============================== */}
          {/* RECIPIENT SECTION              */}
          {/* ============================== */}
          <View style={styles.card}>
            {/* Tabs: Add New / Recent */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, recipientTab === "new" && styles.tabActive]}
                onPress={() => { setRecipientTab("new"); setSelectedRecipient(null); }}
              >
                <Text style={[styles.tabText, recipientTab === "new" && styles.tabTextActive]}>
                  + Add New
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, recipientTab === "recent" && styles.tabActive]}
                onPress={() => setRecipientTab("recent")}
              >
                <Text style={[styles.tabText, recipientTab === "recent" && styles.tabTextActive]}>
                  Recent
                </Text>
              </TouchableOpacity>
            </View>

            {/* Recent Recipients */}
            {recipientTab === "recent" && (
              <View style={styles.recentList}>
                {RECENT_RECIPIENTS.map((recipient) => (
                  <TouchableOpacity
                    key={recipient.id}
                    style={[
                      styles.recipientOption,
                      selectedRecipient?.id === recipient.id && styles.recipientOptionSelected,
                    ]}
                    onPress={() => handleSelectRecipient(recipient)}
                  >
                    <View
                      style={[
                        styles.recipientAvatar,
                        selectedRecipient?.id === recipient.id && styles.recipientAvatarSelected,
                      ]}
                    >
                      <Text style={styles.recipientAvatarText}>{recipient.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.recipientInfo}>
                      <Text style={styles.recipientName}>{recipient.name}</Text>
                      <Text style={styles.recipientIdentifier}>
                        {METHOD_OPTIONS[recipient.method]?.icon} {recipient.identifier}
                      </Text>
                    </View>
                    {selectedRecipient?.id === recipient.id && (
                      <Ionicons name="checkmark" size={20} color="#00C6AE" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Add New Recipient */}
            {recipientTab === "new" && (
              <>
                {/* Send Method Selection */}
                <View style={styles.sectionGroup}>
                  <Text style={styles.label}>Send via</Text>
                  <View style={styles.methodGrid}>
                    {Object.values(METHOD_OPTIONS).map((method) => (
                      <TouchableOpacity
                        key={method.id}
                        style={[
                          styles.methodCard,
                          selectedMethod === method.id && styles.methodCardSelected,
                        ]}
                        onPress={() => handleMethodChange(method.id)}
                      >
                        {method.badge && (
                          <View style={styles.methodBadge}>
                            <Text style={styles.methodBadgeText}>{method.badge}</Text>
                          </View>
                        )}
                        <View style={styles.methodCardRow}>
                          <Text style={styles.methodIcon}>{method.icon}</Text>
                          <View style={styles.flex1}>
                            <Text
                              style={[
                                styles.methodName,
                                selectedMethod === method.id && styles.methodNameSelected,
                              ]}
                            >
                              {method.name}
                            </Text>
                            <Text
                              style={[
                                styles.methodFee,
                                method.fee === 0 && styles.methodFeeFree,
                              ]}
                            >
                              {method.fee === 0 ? "Free" : `${CURRENCY_SYMBOL}${method.fee} fee`}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Recipient Name */}
                <View style={styles.sectionGroup}>
                  <Text style={styles.label}>Recipient Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={recipientName}
                    onChangeText={setRecipientName}
                    placeholder="Enter full name"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* WALLET FIELDS */}
                {selectedMethod === "wallet" && (
                  <View style={styles.sectionGroup}>
                    <Text style={styles.label}>Phone Number or @Username</Text>
                    <View style={styles.lookupRow}>
                      <TextInput
                        style={[
                          styles.textInput,
                          styles.flex1,
                          walletUserFound && styles.textInputSuccess,
                        ]}
                        value={walletLookup}
                        onChangeText={handleWalletLookup}
                        placeholder="@username or phone number"
                        placeholderTextColor="#9CA3AF"
                      />
                      {isLookingUp && (
                        <View style={styles.lookupIndicator}>
                          <ActivityIndicator size="small" color="#00C6AE" />
                        </View>
                      )}
                      {walletUserFound && (
                        <View style={styles.lookupIndicator}>
                          <Ionicons name="checkmark" size={20} color="#00C6AE" />
                        </View>
                      )}
                    </View>

                    {walletUserFound && (
                      <View style={styles.walletUserCard}>
                        <View style={styles.walletUserAvatar}>
                          <Text style={styles.walletUserAvatarText}>
                            {(recipientName || walletUserFound.name).charAt(0)}
                          </Text>
                        </View>
                        <View style={styles.flex1}>
                          <Text style={styles.walletUserName}>
                            {recipientName || walletUserFound.name}
                          </Text>
                          <Text style={styles.walletUserUsername}>
                            {walletUserFound.username} {"\u2022"} TandaXn User
                          </Text>
                        </View>
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedText}>VERIFIED</Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* BANK FIELDS */}
                {selectedMethod === "bank" && (
                  <>
                    <View style={styles.sectionGroup}>
                      <Text style={styles.label}>Bank</Text>
                      <TouchableOpacity
                        style={[styles.pickerButton, selectedBank && styles.pickerButtonSelected]}
                        onPress={() => setShowBankPicker(true)}
                      >
                        <Text style={[styles.pickerText, !selectedBank && styles.pickerPlaceholder]}>
                          {selectedBank || "Select bank"}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.sectionGroup}>
                      <Text style={styles.label}>Account Number</Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          styles.monoInput,
                          accountNumber.length === 10 && styles.textInputSuccess,
                        ]}
                        value={accountNumber}
                        onChangeText={(v) => setAccountNumber(v.replace(/\D/g, "").slice(0, 10))}
                        placeholder="10-digit account number"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        maxLength={10}
                      />
                      {/* Progress dots */}
                      <View style={styles.progressDots}>
                        {[...Array(10)].map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.progressPip,
                              i < accountNumber.length && styles.progressPipFilled,
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  </>
                )}

                {/* MOBILE MONEY FIELDS */}
                {selectedMethod === "mobile" && (
                  <>
                    <View style={styles.sectionGroup}>
                      <Text style={styles.label}>Mobile Network</Text>
                      <View style={styles.networkRow}>
                        {MOBILE_NETWORKS.map((network) => (
                          <TouchableOpacity
                            key={network.id}
                            style={[
                              styles.networkCard,
                              selectedNetwork === network.name && styles.networkCardSelected,
                            ]}
                            onPress={() => setSelectedNetwork(network.name)}
                          >
                            <View style={[styles.networkDot, { backgroundColor: network.color }]} />
                            <Text
                              style={[
                                styles.networkName,
                                selectedNetwork === network.name && styles.networkNameSelected,
                              ]}
                            >
                              {network.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.sectionGroup}>
                      <Text style={styles.label}>Phone Number</Text>
                      <TextInput
                        style={[
                          styles.textInput,
                          styles.monoInput,
                          validatePhoneNumber(phoneNumber) && styles.textInputSuccess,
                        ]}
                        value={phoneNumber}
                        onChangeText={(v) => setPhoneNumber(v.replace(/[^0-9+]/g, "").slice(0, 14))}
                        placeholder="08012345678"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                      />
                    </View>
                  </>
                )}

                {/* CASH PICKUP FIELDS */}
                {selectedMethod === "cash" && (
                  <View style={styles.sectionGroup}>
                    <Text style={styles.label}>Pickup Location</Text>
                    <TouchableOpacity
                      style={[styles.pickerButton, selectedLocation && styles.pickerButtonSelected]}
                      onPress={() => setShowLocationPicker(true)}
                    >
                      <View style={styles.pickerLeftRow}>
                        <Text style={styles.pickerEmoji}>{"\u{1F4CD}"}</Text>
                        <Text style={[styles.pickerText, !selectedLocation && styles.pickerPlaceholder]}>
                          {selectedLocation || "Select pickup location"}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>

          {/* ============================== */}
          {/* AMOUNT SECTION                 */}
          {/* ============================== */}
          <View style={[styles.card, numericAmount > userBalance && styles.cardError]}>
            <Text style={styles.cardTitle}>Amount</Text>
            <View style={styles.amountInputRow}>
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyFlag}>{COUNTRY_FLAG}</Text>
                <Text style={styles.currencySymbolText}>{CURRENCY_SYMBOL}</Text>
              </View>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
            </View>

            {numericAmount > userBalance && (
              <View style={styles.errorBar}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorBarText}>
                  Exceeds balance of {CURRENCY_SYMBOL}{formatCurrency(userBalance)}
                </Text>
              </View>
            )}
          </View>

          {/* ============================== */}
          {/* TRANSFER SUMMARY               */}
          {/* ============================== */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Summary</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.summaryValue}>
                {CURRENCY_SYMBOL}{numericAmount > 0 ? formatCurrency(numericAmount) : "0.00"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryLabelRow}>
                <Text style={styles.summaryLabel}>Fee</Text>
                <Text style={styles.summaryLabelIcon}>{currentMethod?.icon}</Text>
              </View>
              <Text style={[styles.summaryValue, currentFee === 0 && styles.summaryValueFree]}>
                {currentFee === 0 ? "FREE" : `${CURRENCY_SYMBOL}${currentFee.toFixed(2)}`}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>
                {CURRENCY_SYMBOL}{numericAmount > 0 ? formatCurrency(totalToPay) : "0.00"}
              </Text>
            </View>

            {/* Delivery info */}
            <View style={styles.deliveryInfo}>
              <Text style={styles.deliveryIcon}>{currentMethod?.icon}</Text>
              <Text style={styles.deliveryText}>
                {currentMethod?.name} {"\u2022"} {currentMethod?.estimate}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* ============================== */}
        {/* SEND BUTTON                    */}
        {/* ============================== */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.sendButton, (!isFormValid() || isProcessing) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!isFormValid() || isProcessing}
            activeOpacity={0.8}
          >
            <Text style={[styles.sendButtonText, (!isFormValid() || isProcessing) && styles.sendButtonTextDisabled]}>
              {isProcessing
                ? "Sending..."
                : numericAmount > 0
                ? `Send ${CURRENCY_SYMBOL}${formatCurrency(totalToPay)}${currentFee === 0 ? " \u2022 FREE" : ""}`
                : "Send Money"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ============================== */}
      {/* BANK PICKER MODAL              */}
      {/* ============================== */}
      <Modal visible={showBankPicker} animationType="slide" transparent onRequestClose={() => setShowBankPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Bank</Text>
              <TouchableOpacity onPress={() => setShowBankPicker(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {BANKS.map((bank) => (
                <TouchableOpacity
                  key={bank.id}
                  style={[styles.modalOption, selectedBank === bank.name && styles.modalOptionSelected]}
                  onPress={() => { setSelectedBank(bank.name); setShowBankPicker(false); }}
                >
                  <Text style={styles.modalOptionEmoji}>{"\u{1F3E6}"}</Text>
                  <Text style={styles.modalOptionText}>{bank.name}</Text>
                  {selectedBank === bank.name && <Ionicons name="checkmark" size={18} color="#00C6AE" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============================== */}
      {/* LOCATION PICKER MODAL          */}
      {/* ============================== */}
      <Modal visible={showLocationPicker} animationType="slide" transparent onRequestClose={() => setShowLocationPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Pickup Location</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {PICKUP_LOCATIONS.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  style={[styles.modalOption, selectedLocation === location.name && styles.modalOptionSelected]}
                  onPress={() => { setSelectedLocation(location.name); setShowLocationPicker(false); }}
                >
                  <Text style={styles.modalOptionEmoji}>{"\u{1F4CD}"}</Text>
                  <View style={styles.flex1}>
                    <Text style={styles.modalOptionText}>{location.name}</Text>
                    <Text style={styles.modalOptionSub}>{location.address}</Text>
                  </View>
                  {selectedLocation === location.name && <Ionicons name="checkmark" size={18} color="#00C6AE" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  flex1: { flex: 1 },

  // Header
  header: { paddingTop: Platform.OS === "android" ? 40 : 0, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitleContainer: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  placeholder: { width: 40 },
  balanceCard: { padding: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14 },
  balanceLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  balanceAmount: { fontSize: 28, fontWeight: "700", color: "#FFFFFF", marginTop: 6 },

  // Scroll
  scrollContent: { padding: 20, paddingBottom: 120 },

  // Cards
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  cardError: { borderWidth: 2, borderColor: "#DC2626" },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#0A2342", marginBottom: 14 },

  // Tabs
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 16, backgroundColor: "#F5F7FA", borderRadius: 10, padding: 4 },
  tab: { flex: 1, padding: 10, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  tabTextActive: { color: "#0A2342" },

  // Recent list
  recentList: { gap: 10 },
  recipientOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#F5F7FA", borderRadius: 12, borderWidth: 1, borderColor: "transparent" },
  recipientOptionSelected: { backgroundColor: "#F0FDFB", borderWidth: 2, borderColor: "#00C6AE" },
  recipientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  recipientAvatarSelected: { backgroundColor: "#00C6AE" },
  recipientAvatarText: { fontSize: 18, fontWeight: "600", color: "#FFFFFF" },
  recipientInfo: { flex: 1 },
  recipientName: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  recipientIdentifier: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  // Section group
  sectionGroup: { marginBottom: 14 },
  label: { fontSize: 12, color: "#6B7280", marginBottom: 6 },

  // Method grid
  methodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  methodCard: { width: "48%" as any, padding: 12, backgroundColor: "#F5F7FA", borderRadius: 10, borderWidth: 1, borderColor: "transparent" },
  methodCardSelected: { backgroundColor: "#F0FDFB", borderWidth: 2, borderColor: "#00C6AE" },
  methodBadge: { position: "absolute", top: 6, right: 6, backgroundColor: "#00C6AE", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  methodBadgeText: { fontSize: 8, fontWeight: "700", color: "#FFFFFF" },
  methodCardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  methodIcon: { fontSize: 20 },
  methodName: { fontSize: 12, fontWeight: "600", color: "#0A2342" },
  methodNameSelected: { color: "#00897B" },
  methodFee: { fontSize: 10, color: "#6B7280", marginTop: 2 },
  methodFeeFree: { color: "#00C6AE", fontWeight: "600" },

  // Text input
  textInput: { backgroundColor: "#F5F7FA", borderRadius: 10, padding: 12, fontSize: 14, color: "#0A2342", borderWidth: 1, borderColor: "#E5E7EB" },
  textInputSuccess: { borderWidth: 2, borderColor: "#00C6AE", backgroundColor: "#F0FDFB" },
  monoInput: { fontSize: 16, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", letterSpacing: 2 },

  // Wallet lookup
  lookupRow: { position: "relative" },
  lookupIndicator: { position: "absolute", right: 12, top: 12 },

  // Wallet user found
  walletUserCard: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, padding: 12, backgroundColor: "#F0FDFB", borderRadius: 10 },
  walletUserAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#00C6AE", alignItems: "center", justifyContent: "center" },
  walletUserAvatarText: { color: "#FFFFFF", fontWeight: "600" },
  walletUserName: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  walletUserUsername: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  verifiedBadge: { backgroundColor: "#D1FAE5", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText: { fontSize: 9, fontWeight: "600", color: "#059669" },

  // Picker buttons
  pickerButton: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#F5F7FA", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  pickerButtonSelected: { borderWidth: 2, borderColor: "#00C6AE" },
  pickerText: { fontSize: 14, color: "#0A2342" },
  pickerPlaceholder: { color: "#9CA3AF" },
  pickerLeftRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pickerEmoji: { fontSize: 18 },

  // Account progress dots
  progressDots: { flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 10 },
  progressPip: { width: 18, height: 5, borderRadius: 2.5, backgroundColor: "#E5E7EB" },
  progressPipFilled: { backgroundColor: "#00C6AE" },

  // Network row
  networkRow: { flexDirection: "row", gap: 8 },
  networkCard: { flex: 1, padding: 10, backgroundColor: "#F5F7FA", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" },
  networkCardSelected: { backgroundColor: "#F0FDFB", borderWidth: 2, borderColor: "#00C6AE" },
  networkDot: { width: 24, height: 24, borderRadius: 12, marginBottom: 4 },
  networkName: { fontSize: 10, fontWeight: "500", color: "#6B7280" },
  networkNameSelected: { color: "#00897B" },

  // Amount
  amountInputRow: { flexDirection: "row", alignItems: "center", padding: 4, backgroundColor: "#F5F7FA", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  currencyBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#FFFFFF", borderRadius: 8 },
  currencyFlag: { fontSize: 16 },
  currencySymbolText: { fontSize: 18, fontWeight: "700", color: "#0A2342" },
  amountInput: { flex: 1, fontSize: 32, fontWeight: "700", color: "#0A2342", textAlign: "right", paddingHorizontal: 14, paddingVertical: 14 },

  // Error
  errorBar: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 10, backgroundColor: "#FEE2E2", borderRadius: 8 },
  errorBarText: { fontSize: 12, color: "#DC2626" },

  // Summary
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: "#6B7280" },
  summaryLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryLabelIcon: { fontSize: 16 },
  summaryValue: { fontSize: 13, fontWeight: "500", color: "#0A2342" },
  summaryValueFree: { color: "#00C6AE", fontWeight: "600" },
  summaryDivider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },
  summaryTotalLabel: { fontSize: 15, fontWeight: "600", color: "#0A2342" },
  summaryTotalValue: { fontSize: 20, fontWeight: "700", color: "#0A2342" },
  deliveryInfo: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, padding: 10, backgroundColor: "#F0FDFB", borderRadius: 8 },
  deliveryIcon: { fontSize: 16 },
  deliveryText: { fontSize: 12, color: "#065F46" },

  // Bottom bar
  bottomBar: { padding: 16, paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 34 : 20, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  sendButton: { backgroundColor: "#00C6AE", borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { backgroundColor: "#E5E7EB" },
  sendButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  sendButtonTextDisabled: { color: "#9CA3AF" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(10,35,66,0.8)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "60%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342" },
  modalClose: { padding: 4 },
  modalOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#F5F7FA", borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: "transparent" },
  modalOptionSelected: { backgroundColor: "#F0FDFB", borderWidth: 2, borderColor: "#00C6AE" },
  modalOptionEmoji: { fontSize: 20 },
  modalOptionText: { flex: 1, fontSize: 14, fontWeight: "500", color: "#0A2342" },
  modalOptionSub: { fontSize: 11, color: "#6B7280", marginTop: 2 },
});
