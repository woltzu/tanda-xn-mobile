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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useWallet } from "../context/WalletContext";

type SendMoneyNavigationProp = StackNavigationProp<RootStackParamList>;

type Recipient = {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  flag: string;
  isRecent?: boolean;
  isFavorite?: boolean;
};

type SendMethod = {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  fee: string;
  processingTime: string;
};

// Mock recent recipients
const RECENT_RECIPIENTS: Recipient[] = [
  { id: "1", name: "Mama Diallo", phone: "+221 77 XXX XX42", flag: "🇸🇳", isRecent: true, isFavorite: true },
  { id: "2", name: "Amadou Diallo", phone: "+33 6 XX XX XX 85", flag: "🇫🇷", isRecent: true },
  { id: "3", name: "Fatou Ndiaye", phone: "+221 78 XXX XX91", flag: "🇸🇳", isRecent: true },
];

const SEND_METHODS: SendMethod[] = [
  {
    id: "wallet",
    name: "TandaXn Wallet",
    description: "Send to their TandaXn wallet",
    icon: "wallet-outline",
    fee: "Free",
    processingTime: "Instant",
  },
  {
    id: "mobile",
    name: "Mobile Money",
    description: "M-Pesa, Orange Money, Wave",
    icon: "phone-portrait-outline",
    fee: "1%",
    processingTime: "Instant",
  },
  {
    id: "bank",
    name: "Bank Transfer",
    description: "Direct to bank account",
    icon: "business-outline",
    fee: "1.5%",
    processingTime: "1-3 days",
  },
];

export default function SendMoneyScreen() {
  const navigation = useNavigation<SendMoneyNavigationProp>();
  const { balance, sendMoney } = useWallet();
  const [step, setStep] = useState<"destination" | "recipient" | "amount" | "review">("destination");
  const [sendType, setSendType] = useState<"domestic" | "international" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string>("wallet");
  const [note, setNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const selectedMethodData = SEND_METHODS.find((m) => m.id === selectedMethod);

  const getFee = () => {
    if (!selectedMethodData) return 0;
    if (selectedMethodData.fee === "Free") return 0;
    const feePercent = parseFloat(selectedMethodData.fee.replace("%", "") || "0");
    return (numericAmount * feePercent) / 100;
  };

  const fee = getFee();
  const totalAmount = numericAmount + fee;
  const canProceedToAmount = selectedRecipient !== null;
  // Only check balance for TandaXn Wallet - other methods don't use wallet balance
  const isWalletMethod = selectedMethod === "wallet";
  const canProceedToReview = numericAmount >= 1 && (!isWalletMethod || numericAmount <= balance);
  const canSend = canProceedToReview && selectedRecipient !== null;

  const filteredRecipients = RECENT_RECIPIENTS.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phone.includes(searchQuery)
  );

  const handleSelectRecipient = (recipient: Recipient) => {
    setSelectedRecipient(recipient);
    setStep("amount");
  };

  const handleContinueToReview = () => {
    if (canProceedToReview) {
      setStep("review");
    }
  };

  const handleSendMoney = async () => {
    if (!canSend) return;

    setIsProcessing(true);
    try {
      // Send money via wallet context
      await sendMoney(numericAmount, selectedRecipient?.name || "", selectedMethodData?.name || "");

      // Navigate to success screen
      navigation.navigate("WalletTransactionSuccess", {
        type: "send",
        amount: numericAmount,
        method: selectedMethodData?.name || "",
        recipientName: selectedRecipient?.name,
        transactionId: `TXN${Date.now()}`,
      });
    } catch (error) {
      console.error("Error sending money:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectDestination = (type: "domestic" | "international") => {
    if (type === "international") {
      // Navigate to Remittance screen for international transfers
      navigation.navigate("Remittance");
    } else {
      setSendType(type);
      setStep("recipient");
    }
  };

  const renderDestinationStep = () => (
    <>
      {/* Destination Type Selection */}
      <View style={styles.destinationContainer}>
        <Text style={styles.destinationTitle}>Where are you sending?</Text>
        <Text style={styles.destinationSubtitle}>
          Choose your transfer destination
        </Text>

        <TouchableOpacity
          style={[
            styles.destinationCard,
            sendType === "domestic" && styles.destinationCardSelected,
          ]}
          onPress={() => handleSelectDestination("domestic")}
        >
          <View style={[styles.destinationIcon, { backgroundColor: "#F0FDFB" }]}>
            <Ionicons name="home-outline" size={28} color="#00C6AE" />
          </View>
          <View style={styles.destinationInfo}>
            <Text style={styles.destinationLabel}>Domestic</Text>
            <Text style={styles.destinationDesc}>
              Send within the United States
            </Text>
          </View>
          <View style={styles.destinationArrow}>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.destinationCard,
            sendType === "international" && styles.destinationCardSelected,
          ]}
          onPress={() => handleSelectDestination("international")}
        >
          <View style={[styles.destinationIcon, { backgroundColor: "#EEF2FF" }]}>
            <Ionicons name="globe-outline" size={28} color="#6366F1" />
          </View>
          <View style={styles.destinationInfo}>
            <Text style={styles.destinationLabel}>International</Text>
            <Text style={styles.destinationDesc}>
              Send abroad to family & friends
            </Text>
          </View>
          <View style={styles.destinationArrow}>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            International transfers may include exchange rates and additional fees
          </Text>
        </View>
      </View>
    </>
  );

  const renderRecipientStep = () => (
    <>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search name or phone number"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* New Recipient Button */}
      <TouchableOpacity style={styles.newRecipientButton}>
        <View style={styles.newRecipientIcon}>
          <Ionicons name="person-add-outline" size={22} color="#00C6AE" />
        </View>
        <View style={styles.newRecipientInfo}>
          <Text style={styles.newRecipientTitle}>Send to New Recipient</Text>
          <Text style={styles.newRecipientSubtitle}>Enter phone number or email</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>

      {/* Recent Recipients */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent</Text>
        {filteredRecipients.map((recipient) => (
          <TouchableOpacity
            key={recipient.id}
            style={styles.recipientCard}
            onPress={() => handleSelectRecipient(recipient)}
          >
            <View style={styles.recipientLeft}>
              <View style={styles.recipientAvatar}>
                <Text style={styles.recipientAvatarText}>
                  {recipient.name.charAt(0)}
                </Text>
              </View>
              <View style={styles.recipientInfo}>
                <View style={styles.recipientNameRow}>
                  <Text style={styles.recipientName}>{recipient.name}</Text>
                  {recipient.isFavorite && (
                    <Ionicons name="star" size={14} color="#F59E0B" />
                  )}
                </View>
                <View style={styles.recipientPhoneRow}>
                  <Text style={styles.recipientFlag}>{recipient.flag}</Text>
                  <Text style={styles.recipientPhone}>{recipient.phone}</Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  const renderAmountStep = () => (
    <>
      {/* Selected Recipient */}
      <View style={styles.selectedRecipientCard}>
        <View style={styles.selectedRecipientLeft}>
          <View style={styles.recipientAvatar}>
            <Text style={styles.recipientAvatarText}>
              {selectedRecipient?.name.charAt(0)}
            </Text>
          </View>
          <View style={styles.selectedRecipientInfo}>
            <Text style={styles.recipientName} numberOfLines={1}>{selectedRecipient?.name}</Text>
            <View style={styles.recipientPhoneRow}>
              <Text style={styles.recipientFlag}>{selectedRecipient?.flag}</Text>
              <Text style={styles.recipientPhone} numberOfLines={1}>{selectedRecipient?.phone}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.changeButton} onPress={() => setStep("recipient")}>
          <Text style={styles.changeText}>Change</Text>
        </TouchableOpacity>
      </View>

      {/* Amount Input */}
      <View style={styles.amountSection}>
        <Text style={styles.sectionTitle}>You Send</Text>
        <View style={styles.amountInputContainer}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            autoFocus
          />
        </View>
        {isWalletMethod && (
          <Text style={styles.balanceText}>
            Wallet balance: ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
        )}
        {isWalletMethod && numericAmount > balance && (
          <Text style={styles.errorText}>Insufficient wallet balance</Text>
        )}
        {!isWalletMethod && (
          <Text style={styles.balanceText}>
            Will be charged to your {selectedMethodData?.name}
          </Text>
        )}
      </View>

      {/* Exchange Rate Info (for international transfers) */}
      {sendType === "international" && numericAmount > 0 && (
        <View style={styles.exchangeRateCard}>
          <View style={styles.exchangeRateRow}>
            <Text style={styles.exchangeRateLabel}>Exchange Rate</Text>
            <Text style={styles.exchangeRateValue}>1 USD = 610 XOF</Text>
          </View>
          <View style={styles.exchangeRateDivider} />
          <View style={styles.exchangeRateRow}>
            <Text style={styles.exchangeRateLabel}>Recipient Receives</Text>
            <Text style={styles.recipientReceivesValue}>
              XOF {(numericAmount * 610).toLocaleString()}
            </Text>
          </View>
        </View>
      )}

      {/* Send Method */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Send Via</Text>
        {SEND_METHODS.map((method) => (
          <TouchableOpacity
            key={method.id}
            style={[
              styles.methodCard,
              selectedMethod === method.id && styles.methodCardSelected,
            ]}
            onPress={() => setSelectedMethod(method.id)}
          >
            <View style={styles.methodLeft}>
              <View
                style={[
                  styles.methodIcon,
                  selectedMethod === method.id && styles.methodIconSelected,
                ]}
              >
                <Ionicons
                  name={method.icon}
                  size={20}
                  color={selectedMethod === method.id ? "#00C6AE" : "#6B7280"}
                />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodName}>{method.name}</Text>
                <Text style={styles.methodDescription}>{method.description}</Text>
              </View>
            </View>
            <View style={styles.methodRight}>
              <View style={styles.methodDetails}>
                <Text style={styles.methodFee}>{method.fee}</Text>
                <Text style={styles.methodTime}>{method.processingTime}</Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  selectedMethod === method.id && styles.radioOuterSelected,
                ]}
              >
                {selectedMethod === method.id && <View style={styles.radioInner} />}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Note */}
      <View style={styles.noteSection}>
        <Text style={styles.sectionTitle}>Add a Note (Optional)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="What's this for?"
          placeholderTextColor="#9CA3AF"
          multiline
        />
      </View>
    </>
  );

  // Get first name for personalized message
  const getFirstName = () => {
    if (!selectedRecipient?.name) return "";
    return selectedRecipient.name.split(" ")[0];
  };

  const renderReviewStep = () => (
    <>
      {/* RECIPIENT RECEIVES - Main highlight */}
      <View style={styles.recipientReceivesCard}>
        <View style={styles.recipientReceivesHeader}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={styles.recipientReceivesLabel}>
            {getFirstName()} receives exactly
          </Text>
        </View>
        <Text style={styles.recipientReceivesAmount}>
          ${numericAmount.toFixed(2)}
        </Text>
        <Text style={styles.recipientReceivesNote}>
          No hidden fees. What you see is what they get.
        </Text>
      </View>

      {/* Transaction Summary */}
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewTitle}>Sending to</Text>
        </View>
        <View style={styles.reviewRecipient}>
          <View style={styles.reviewRecipientAvatar}>
            <Text style={styles.reviewRecipientAvatarText}>
              {selectedRecipient?.name.charAt(0)}
            </Text>
          </View>
          <Text style={styles.reviewRecipientName}>{selectedRecipient?.name}</Text>
          <View style={styles.recipientPhoneRow}>
            <Text style={styles.recipientFlag}>{selectedRecipient?.flag}</Text>
            <Text style={styles.recipientPhone}>{selectedRecipient?.phone}</Text>
          </View>
        </View>

        <View style={styles.reviewDivider} />

        <View style={styles.reviewDetails}>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>You send</Text>
            <Text style={styles.reviewValue}>${numericAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Processing fee ({selectedMethodData?.fee})</Text>
            <Text style={styles.reviewValue}>${fee.toFixed(2)}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Send via</Text>
            <Text style={styles.reviewValue}>{selectedMethodData?.name}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Arrives</Text>
            <Text style={styles.reviewValue}>{selectedMethodData?.processingTime}</Text>
          </View>
          {note && (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Note</Text>
              <Text style={[styles.reviewValue, styles.reviewNote]}>{note}</Text>
            </View>
          )}
        </View>

        <View style={styles.reviewDivider} />

        <View style={styles.reviewTotal}>
          <Text style={styles.reviewTotalLabel}>You pay</Text>
          <Text style={styles.reviewTotalAmount}>${totalAmount.toFixed(2)}</Text>
        </View>
      </View>

      {/* Security Notice */}
      <View style={styles.securityNotice}>
        <Ionicons name="shield-checkmark" size={18} color="#00C6AE" />
        <Text style={styles.securityText}>
          This transaction is secured and encrypted
        </Text>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (step === "recipient") setStep("destination");
                else if (step === "amount") setStep("recipient");
                else if (step === "review") setStep("amount");
                else navigation.goBack();
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {step === "destination" ? "Send Money" : step === "recipient" ? "Recipient Details" : step === "amount" ? "Enter Amount" : "Review"}
            </Text>
            <View style={styles.placeholder} />
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={[styles.progressLine, step !== "destination" && styles.progressLineActive]} />
            <View style={[styles.progressDot, step !== "destination" && styles.progressDotActive]} />
            <View style={[styles.progressLine, (step === "amount" || step === "review") && styles.progressLineActive]} />
            <View style={[styles.progressDot, (step === "amount" || step === "review") && styles.progressDotActive]} />
            <View style={[styles.progressLine, step === "review" && styles.progressLineActive]} />
            <View style={[styles.progressDot, step === "review" && styles.progressDotActive]} />
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {step === "destination" && renderDestinationStep()}
          {step === "recipient" && renderRecipientStep()}
          {step === "amount" && renderAmountStep()}
          {step === "review" && renderReviewStep()}
        </ScrollView>

        {/* Bottom Button */}
        {step !== "destination" && step !== "recipient" && (
          <View style={styles.bottomBar}>
            {step === "amount" ? (
              <TouchableOpacity
                style={[styles.continueButton, !canProceedToReview && styles.continueButtonDisabled]}
                onPress={handleContinueToReview}
                disabled={!canProceedToReview}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.sendButton, isProcessing && styles.sendButtonProcessing]}
                onPress={handleSendMoney}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Text style={styles.sendButtonText}>Sending...</Text>
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                    <Text style={styles.sendButtonText}>
                      Send ${totalAmount.toFixed(2)}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  // Destination Step Styles
  destinationContainer: {
    paddingTop: 20,
  },
  destinationTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 8,
  },
  destinationSubtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginBottom: 24,
  },
  destinationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  destinationCardSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  destinationIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  destinationInfo: {
    flex: 1,
  },
  destinationLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  destinationDesc: {
    fontSize: 14,
    color: "#6B7280",
  },
  destinationArrow: {
    marginLeft: 8,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  // Exchange Rate Styles
  exchangeRateCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  exchangeRateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exchangeRateLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  exchangeRateValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  exchangeRateDivider: {
    height: 1,
    backgroundColor: "rgba(0,198,174,0.3)",
    marginVertical: 12,
  },
  recipientReceivesValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00C6AE",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  placeholder: {
    width: 40,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  progressDotActive: {
    backgroundColor: "#00C6AE",
  },
  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginHorizontal: 4,
  },
  progressLineActive: {
    backgroundColor: "#00C6AE",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0A2342",
  },
  newRecipientButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  newRecipientIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  newRecipientInfo: {
    flex: 1,
  },
  newRecipientTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  newRecipientSubtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  recipientCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  selectedRecipientCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  selectedRecipientLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  selectedRecipientInfo: {
    flex: 1,
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#E0F7F4",
    borderRadius: 8,
  },
  recipientLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  recipientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  recipientAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  recipientInfo: {
    flex: 1,
  },
  recipientNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  recipientName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  recipientPhoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recipientFlag: {
    fontSize: 14,
  },
  recipientPhone: {
    fontSize: 13,
    color: "#6B7280",
  },
  changeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  amountSection: {
    marginBottom: 24,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: "700",
    color: "#0A2342",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: "700",
    color: "#0A2342",
  },
  balanceText: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 8,
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
    marginTop: 4,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  methodCardSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  methodLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  methodIconSelected: {
    backgroundColor: "#E0F7F4",
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  methodDescription: {
    fontSize: 12,
    color: "#6B7280",
  },
  methodRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  methodDetails: {
    alignItems: "flex-end",
  },
  methodFee: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
  },
  methodTime: {
    fontSize: 11,
    color: "#6B7280",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: "#00C6AE",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00C6AE",
  },
  noteSection: {
    marginBottom: 24,
  },
  noteInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#0A2342",
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  reviewHeader: {
    marginBottom: 16,
  },
  reviewTitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  reviewRecipient: {
    alignItems: "center",
    marginBottom: 20,
  },
  reviewRecipientAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  reviewRecipientAvatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  reviewRecipientName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 16,
  },
  reviewDetails: {
    gap: 12,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  reviewLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0A2342",
    textAlign: "right",
    maxWidth: "60%",
  },
  reviewNote: {
    fontStyle: "italic",
  },
  reviewTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  reviewTotalAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#00C6AE",
  },
  recipientReceivesCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#10B981",
    alignItems: "center",
  },
  recipientReceivesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  recipientReceivesLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#065F46",
  },
  recipientReceivesAmount: {
    fontSize: 42,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: -1,
  },
  recipientReceivesNote: {
    fontSize: 13,
    color: "#047857",
    marginTop: 4,
    textAlign: "center",
  },
  securityNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  securityText: {
    fontSize: 13,
    color: "#6B7280",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  continueButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  sendButtonProcessing: {
    backgroundColor: "#9CA3AF",
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
