import React, { useState, useEffect, useRef, useCallback } from "react";
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

type Recipient = {
  id: string;
  name: string;
  phone: string;
  country: string;
  flag: string;
};

type Country = {
  code: string;
  name: string;
  flag: string;
  currency: string;
  currencyName: string;
  dialCode: string;
  rate: number;
  decimals: number;
};

type DeliveryOption = {
  id: string;
  label: string;
  time: string;
  fee: number;
  icon: string;
};

const RECENT_RECIPIENTS: Recipient[] = [
  { id: "r1", name: "Mama Diallo", phone: "+221 77 XXX XX42", country: "SN", flag: "\u{1F1F8}\u{1F1F3}" },
  { id: "r2", name: "Amadou Diallo", phone: "+221 78 XXX XX15", country: "SN", flag: "\u{1F1F8}\u{1F1F3}" },
  { id: "r3", name: "Fatou Ndiaye", phone: "+221 76 XXX XX89", country: "SN", flag: "\u{1F1F8}\u{1F1F3}" },
  { id: "r4", name: "Kwame Asante", phone: "+233 24 XXX XX33", country: "GH", flag: "\u{1F1EC}\u{1F1ED}" },
];

const COUNTRIES: Country[] = [
  { code: "SN", name: "Senegal", flag: "\u{1F1F8}\u{1F1F3}", currency: "XOF", currencyName: "CFA Franc", dialCode: "+221", rate: 605.50, decimals: 0 },
  { code: "NG", name: "Nigeria", flag: "\u{1F1F3}\u{1F1EC}", currency: "NGN", currencyName: "Naira", dialCode: "+234", rate: 1550.00, decimals: 0 },
  { code: "KE", name: "Kenya", flag: "\u{1F1F0}\u{1F1EA}", currency: "KES", currencyName: "Shilling", dialCode: "+254", rate: 129.50, decimals: 0 },
  { code: "GH", name: "Ghana", flag: "\u{1F1EC}\u{1F1ED}", currency: "GHS", currencyName: "Cedi", dialCode: "+233", rate: 15.80, decimals: 2 },
  { code: "CM", name: "Cameroon", flag: "\u{1F1E8}\u{1F1F2}", currency: "XAF", currencyName: "CFA Franc", dialCode: "+237", rate: 605.50, decimals: 0 },
  { code: "CI", name: "Ivory Coast", flag: "\u{1F1E8}\u{1F1EE}", currency: "XOF", currencyName: "CFA Franc", dialCode: "+225", rate: 605.50, decimals: 0 },
  { code: "ML", name: "Mali", flag: "\u{1F1F2}\u{1F1F1}", currency: "XOF", currencyName: "CFA Franc", dialCode: "+223", rate: 605.50, decimals: 0 },
  { code: "BF", name: "Burkina Faso", flag: "\u{1F1E7}\u{1F1EB}", currency: "XOF", currencyName: "CFA Franc", dialCode: "+226", rate: 605.50, decimals: 0 },
  { code: "TG", name: "Togo", flag: "\u{1F1F9}\u{1F1EC}", currency: "XOF", currencyName: "CFA Franc", dialCode: "+228", rate: 605.50, decimals: 0 },
  { code: "BJ", name: "Benin", flag: "\u{1F1E7}\u{1F1EF}", currency: "XOF", currencyName: "CFA Franc", dialCode: "+229", rate: 605.50, decimals: 0 },
  { code: "NE", name: "Niger", flag: "\u{1F1F3}\u{1F1EA}", currency: "XOF", currencyName: "CFA Franc", dialCode: "+227", rate: 605.50, decimals: 0 },
  { code: "GN", name: "Guinea", flag: "\u{1F1EC}\u{1F1F3}", currency: "GNF", currencyName: "Franc", dialCode: "+224", rate: 8600.00, decimals: 0 },
  { code: "CD", name: "DR Congo", flag: "\u{1F1E8}\u{1F1E9}", currency: "CDF", currencyName: "Franc", dialCode: "+243", rate: 2750.00, decimals: 0 },
  { code: "ZA", name: "South Africa", flag: "\u{1F1FF}\u{1F1E6}", currency: "ZAR", currencyName: "Rand", dialCode: "+27", rate: 18.50, decimals: 2 },
  { code: "TZ", name: "Tanzania", flag: "\u{1F1F9}\u{1F1FF}", currency: "TZS", currencyName: "Shilling", dialCode: "+255", rate: 2650.00, decimals: 0 },
  { code: "UG", name: "Uganda", flag: "\u{1F1FA}\u{1F1EC}", currency: "UGX", currencyName: "Shilling", dialCode: "+256", rate: 3750.00, decimals: 0 },
  { code: "RW", name: "Rwanda", flag: "\u{1F1F7}\u{1F1FC}", currency: "RWF", currencyName: "Franc", dialCode: "+250", rate: 1300.00, decimals: 0 },
  { code: "ET", name: "Ethiopia", flag: "\u{1F1EA}\u{1F1F9}", currency: "ETB", currencyName: "Birr", dialCode: "+251", rate: 56.80, decimals: 0 },
  { code: "MA", name: "Morocco", flag: "\u{1F1F2}\u{1F1E6}", currency: "MAD", currencyName: "Dirham", dialCode: "+212", rate: 10.10, decimals: 2 },
  { code: "EG", name: "Egypt", flag: "\u{1F1EA}\u{1F1EC}", currency: "EGP", currencyName: "Pound", dialCode: "+20", rate: 48.50, decimals: 2 },
  { code: "IN", name: "India", flag: "\u{1F1EE}\u{1F1F3}", currency: "INR", currencyName: "Rupee", dialCode: "+91", rate: 83.20, decimals: 0 },
  { code: "PH", name: "Philippines", flag: "\u{1F1F5}\u{1F1ED}", currency: "PHP", currencyName: "Peso", dialCode: "+63", rate: 56.50, decimals: 0 },
  { code: "BD", name: "Bangladesh", flag: "\u{1F1E7}\u{1F1E9}", currency: "BDT", currencyName: "Taka", dialCode: "+880", rate: 110.00, decimals: 0 },
  { code: "PK", name: "Pakistan", flag: "\u{1F1F5}\u{1F1F0}", currency: "PKR", currencyName: "Rupee", dialCode: "+92", rate: 278.50, decimals: 0 },
  { code: "MX", name: "Mexico", flag: "\u{1F1F2}\u{1F1FD}", currency: "MXN", currencyName: "Peso", dialCode: "+52", rate: 17.20, decimals: 2 },
  { code: "CO", name: "Colombia", flag: "\u{1F1E8}\u{1F1F4}", currency: "COP", currencyName: "Peso", dialCode: "+57", rate: 3950.00, decimals: 0 },
  { code: "HT", name: "Haiti", flag: "\u{1F1ED}\u{1F1F9}", currency: "HTG", currencyName: "Gourde", dialCode: "+509", rate: 132.50, decimals: 0 },
  { code: "JM", name: "Jamaica", flag: "\u{1F1EF}\u{1F1F2}", currency: "JMD", currencyName: "Dollar", dialCode: "+1876", rate: 155.00, decimals: 0 },
  { code: "GB", name: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}", currency: "GBP", currencyName: "Pound", dialCode: "+44", rate: 0.79, decimals: 2 },
  { code: "FR", name: "France", flag: "\u{1F1EB}\u{1F1F7}", currency: "EUR", currencyName: "Euro", dialCode: "+33", rate: 0.92, decimals: 2 },
];

const DELIVERY_OPTIONS: DeliveryOption[] = [
  { id: "standard", label: "Standard", time: "3-5 days", fee: 2.99, icon: "\u{1F4E6}" },
  { id: "express", label: "Express", time: "1-2 days", fee: 4.99, icon: "\u{1F680}" },
  { id: "instant", label: "Instant", time: "Minutes", fee: 7.99, icon: "\u{26A1}" },
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function RemittanceScreen() {
  const navigation = useNavigation<NavProp>();
  const { balance, sendMoney } = useWallet();

  // State
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newRecipientName, setNewRecipientName] = useState("");
  const [newRecipientPhone, setNewRecipientPhone] = useState("");

  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const [sendAmount, setSendAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");
  const [lastEditedField, setLastEditedField] = useState<string | null>(null);

  const [selectedSpeed, setSelectedSpeed] = useState("standard");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived
  const currentFee = DELIVERY_OPTIONS.find((d) => d.id === selectedSpeed)?.fee || 2.99;
  const exchangeRate = selectedCountry.rate;
  const numericSendAmount = parseFloat(sendAmount) || 0;
  const numericReceiveAmount = parseFloat(receiveAmount) || 0;
  const totalToPay = numericSendAmount + currentFee;

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.currency.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Validation
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!selectedRecipient && !showAddNew) newErrors.recipient = "Please select or add a recipient";
    if (showAddNew) {
      if (!newRecipientName.trim() || newRecipientName.length < 2) newErrors.name = "Please enter recipient's full name";
      if (!newRecipientPhone || newRecipientPhone.length < 8) newErrors.phone = "Please enter a valid phone number";
    }
    if (numericSendAmount <= 0) newErrors.amount = "Please enter an amount to send";
    else if (totalToPay > balance) newErrors.amount = "Insufficient balance for amount + fee";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedRecipient, showAddNew, newRecipientName, newRecipientPhone, numericSendAmount, totalToPay, balance]);

  const isFormValid = useCallback(() => {
    const hasRecipient = selectedRecipient || (showAddNew && newRecipientName.length >= 2 && newRecipientPhone.length >= 8);
    const hasValidAmount = numericSendAmount > 0 && totalToPay <= balance;
    return hasRecipient && hasValidAmount;
  }, [selectedRecipient, showAddNew, newRecipientName, newRecipientPhone, numericSendAmount, totalToPay, balance]);

  // Amount sync
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (lastEditedField === "send" && sendAmount) {
        const calc = numericSendAmount * exchangeRate;
        setReceiveAmount(selectedCountry.decimals === 0 ? Math.round(calc).toString() : calc.toFixed(selectedCountry.decimals));
      } else if (lastEditedField === "receive" && receiveAmount) {
        setSendAmount((numericReceiveAmount / exchangeRate).toFixed(2));
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [sendAmount, receiveAmount, lastEditedField, exchangeRate, selectedCountry.decimals]);

  useEffect(() => {
    if (lastEditedField === "send" && numericSendAmount > 0) {
      const calc = numericSendAmount * exchangeRate;
      setReceiveAmount(selectedCountry.decimals === 0 ? Math.round(calc).toString() : calc.toFixed(selectedCountry.decimals));
    } else if (lastEditedField === "receive" && numericReceiveAmount > 0) {
      setSendAmount((numericReceiveAmount / exchangeRate).toFixed(2));
    }
  }, [selectedCountry]);

  // Handlers
  const handleSendAmountChange = (value: string) => { setSendAmount(value.replace(/[^0-9.]/g, "")); setLastEditedField("send"); };
  const handleReceiveAmountChange = (value: string) => { setReceiveAmount(value.replace(/[^0-9.]/g, "")); setLastEditedField("receive"); };
  const handleSwapFields = () => setLastEditedField(lastEditedField === "send" ? "receive" : "send");

  const handleSelectRecipient = (r: Recipient) => {
    setSelectedRecipient(r);
    setShowAddNew(false);
    const c = COUNTRIES.find((c) => c.code === r.country);
    if (c) setSelectedCountry(c);
  };

  const handleSend = async () => {
    if (!validateForm()) return;
    setIsProcessing(true);
    try {
      const name = selectedRecipient?.name || newRecipientName || "Recipient";
      const method = `International - ${DELIVERY_OPTIONS.find((d) => d.id === selectedSpeed)?.label || "Standard"}`;
      const txnId = await sendMoney(numericSendAmount, name, method, selectedCountry.currency);
      navigation.navigate("WalletTransactionSuccess", {
        type: "send",
        amount: numericSendAmount,
        method,
        recipientName: name,
        transactionId: txnId || `TXN${Date.now()}`,
      });
    } catch (error) {
      Alert.alert("Transfer Failed", "Something went wrong. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number, decimals = 2) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount);

  const formatReceiveAmount = (amount: number) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: selectedCountry.decimals, maximumFractionDigits: selectedCountry.decimals }).format(amount);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <View style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex1}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={s.header}>
          <SafeAreaView>
            <View style={s.headerRow}>
              <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={s.headerTitleContainer}>
                <Text style={s.headerTitle}>Send Money</Text>
                <Text style={s.headerSubtitle}>Fast & secure transfers</Text>
              </View>
              <View style={s.placeholder} />
            </View>
            <View style={s.headerCards}>
              <View style={s.balanceCard}>
                <Text style={s.balanceLabel}>Your Balance</Text>
                <Text style={s.balanceAmount}>${formatCurrency(balance)}</Text>
              </View>
              <View style={s.rateCard}>
                <Text style={s.rateLabel}>Exchange Rate</Text>
                <Text style={s.rateAmount}>1 USD = {formatCurrency(exchangeRate, 2)} {selectedCountry.currency}</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <ScrollView style={s.flex1} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* RECIPIENT */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Recipient</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipScrollContent}>
              {RECENT_RECIPIENTS.map((r) => (
                <TouchableOpacity key={r.id} style={[s.chip, selectedRecipient?.id === r.id && s.chipSelected]} onPress={() => handleSelectRecipient(r)} activeOpacity={0.7}>
                  <View style={[s.chipAvatar, selectedRecipient?.id === r.id && s.chipAvatarSelected]}>
                    <Text style={s.chipAvatarText}>{r.flag}</Text>
                  </View>
                  <Text style={[s.chipName, selectedRecipient?.id === r.id && s.chipNameSelected]} numberOfLines={1}>{r.name.split(" ")[0]}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[s.chip, showAddNew && s.chipSelected]} onPress={() => { setShowAddNew(true); setSelectedRecipient(null); }} activeOpacity={0.7}>
                <View style={[s.chipAvatar, showAddNew && s.chipAvatarSelected]}>
                  <Ionicons name="add" size={22} color={showAddNew ? "#FFFFFF" : "#6B7280"} />
                </View>
                <Text style={[s.chipName, showAddNew && s.chipNameSelected]}>Add New</Text>
              </TouchableOpacity>
            </ScrollView>

            {showAddNew && (
              <View style={s.addNewForm}>
                <View style={s.inputGroup}>
                  <Text style={s.label}>Full Name</Text>
                  <TextInput style={[s.textInput, errors.name && s.textInputError]} value={newRecipientName} onChangeText={(v) => { setNewRecipientName(v); if (errors.name) setErrors((p) => ({ ...p, name: "" })); }} placeholder="Enter recipient's full name" placeholderTextColor="#9CA3AF" />
                  {errors.name ? <Text style={s.errorText}>{errors.name}</Text> : null}
                </View>
                <View style={s.inputGroup}>
                  <Text style={s.label}>Phone Number</Text>
                  <View style={s.phoneRow}>
                    <TouchableOpacity style={s.dialCodeButton} onPress={() => setShowCountryPicker(true)}>
                      <Text style={s.dialCodeFlag}>{selectedCountry.flag}</Text>
                      <Text style={s.dialCodeText}>{selectedCountry.dialCode}</Text>
                      <Ionicons name="chevron-down" size={14} color="#6B7280" />
                    </TouchableOpacity>
                    <TextInput style={[s.phoneInput, errors.phone && s.textInputError]} value={newRecipientPhone} onChangeText={(v) => { setNewRecipientPhone(v); if (errors.phone) setErrors((p) => ({ ...p, phone: "" })); }} placeholder="Phone number" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />
                  </View>
                  {errors.phone ? <Text style={s.errorText}>{errors.phone}</Text> : null}
                </View>
              </View>
            )}

            {selectedRecipient && !showAddNew && (
              <View style={s.selectedBar}>
                <View style={s.selectedAvatar}><Text style={s.selectedFlag}>{selectedRecipient.flag}</Text></View>
                <View style={s.flex1}>
                  <Text style={s.selectedName}>{selectedRecipient.name}</Text>
                  <Text style={s.selectedPhone}>{selectedRecipient.phone}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color="#00C6AE" />
              </View>
            )}
          </View>

          {/* AMOUNT */}
          <View style={[s.card, errors.amount && s.cardError]}>
            <Text style={s.cardTitle}>Amount</Text>
            <View style={s.amountGroup}>
              <Text style={s.label}>You send (USD)</Text>
              <View style={[s.amountRow, lastEditedField === "send" && s.amountRowActive]}>
                <View style={s.currencyBadge}>
                  <Text style={s.currencyFlag}>{"\u{1F1FA}\u{1F1F8}"}</Text>
                  <Text style={s.currencyCode}>USD</Text>
                </View>
                <TextInput style={s.amountInput} value={sendAmount} onChangeText={handleSendAmountChange} placeholder="0.00" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
              </View>
            </View>
            <View style={s.swapContainer}>
              <TouchableOpacity style={s.swapButton} onPress={handleSwapFields}>
                <Ionicons name="swap-vertical" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={s.amountGroup}>
              <Text style={s.label}>They receive ({selectedCountry.currency})</Text>
              <View style={[s.amountRow, lastEditedField === "receive" && s.amountRowActive]}>
                <TouchableOpacity style={s.currencyBadge} onPress={() => setShowCountryPicker(true)}>
                  <Text style={s.currencyFlag}>{selectedCountry.flag}</Text>
                  <Text style={s.currencyCode}>{selectedCountry.currency}</Text>
                  <Ionicons name="chevron-down" size={14} color="#6B7280" />
                </TouchableOpacity>
                <TextInput style={[s.amountInput, { color: "#00C6AE" }]} value={receiveAmount} onChangeText={handleReceiveAmountChange} placeholder="0" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
              </View>
            </View>
            {errors.amount ? <View style={s.amountError}><Ionicons name="alert-circle" size={16} color="#DC2626" /><Text style={s.amountErrorText}>{errors.amount}</Text></View> : null}
          </View>

          {/* DELIVERY SPEED */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Delivery Speed</Text>
            <View style={s.speedRow}>
              {DELIVERY_OPTIONS.map((o) => (
                <TouchableOpacity key={o.id} style={[s.speedCard, selectedSpeed === o.id && s.speedCardSelected]} onPress={() => setSelectedSpeed(o.id)} activeOpacity={0.7}>
                  <Text style={s.speedIcon}>{o.icon}</Text>
                  <Text style={[s.speedLabel, selectedSpeed === o.id && s.speedLabelSelected]}>{o.label}</Text>
                  <Text style={s.speedTime}>{o.time}</Text>
                  <Text style={[s.speedFee, selectedSpeed === o.id && s.speedFeeSelected]}>${o.fee.toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* SUMMARY */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Transfer Summary</Text>
            <View style={s.summaryRow}><Text style={s.summaryLabel}>You send</Text><Text style={s.summaryValue}>${numericSendAmount > 0 ? formatCurrency(numericSendAmount) : "0.00"}</Text></View>
            <View style={s.summaryRow}><Text style={s.summaryLabel}>Transfer fee</Text><Text style={s.summaryValue}>${currentFee.toFixed(2)}</Text></View>
            <View style={s.summaryRow}><Text style={s.summaryLabel}>Exchange rate</Text><Text style={s.summaryValue}>1 USD = {formatCurrency(exchangeRate, 2)} {selectedCountry.currency}</Text></View>
            <View style={s.summaryDivider} />
            <View style={s.summaryRow}><Text style={s.summaryTotalLabel}>Total to pay</Text><Text style={s.summaryTotalValue}>${numericSendAmount > 0 ? formatCurrency(totalToPay) : "0.00"}</Text></View>
            <View style={s.summaryRow}><Text style={[s.summaryTotalLabel, { color: "#00897B" }]}>They receive</Text><Text style={s.summaryReceiveValue}>{numericReceiveAmount > 0 ? formatReceiveAmount(numericReceiveAmount) : "0"} {selectedCountry.currency}</Text></View>
          </View>

          {numericSendAmount > 0 && (
            <View style={s.savingsCard}>
              <Text style={s.savingsIcon}>{"\u{1F4B0}"}</Text>
              <Text style={s.savingsText}>You save <Text style={s.savingsBold}>${((numericSendAmount * 0.07) - currentFee).toFixed(2)}</Text> compared to traditional services</Text>
            </View>
          )}
        </ScrollView>

        {/* SEND BUTTON */}
        <View style={s.bottomBar}>
          <TouchableOpacity style={[s.sendButton, (!isFormValid() || isProcessing) && s.sendButtonDisabled]} onPress={handleSend} disabled={!isFormValid() || isProcessing} activeOpacity={0.8}>
            <Text style={[s.sendButtonText, (!isFormValid() || isProcessing) && s.sendButtonTextDisabled]}>
              {isProcessing ? "Sending..." : numericSendAmount > 0 ? `Send $${formatCurrency(totalToPay)}` : "Send Money"}
            </Text>
          </TouchableOpacity>
          <Text style={s.securityNote}>{"\u{1F512}"} Secured by TandaXn - Your money is protected</Text>
        </View>
      </KeyboardAvoidingView>

      {/* COUNTRY PICKER */}
      <Modal visible={showCountryPicker} animationType="slide" transparent onRequestClose={() => setShowCountryPicker(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => { setShowCountryPicker(false); setCountrySearch(""); }} style={s.modalClose}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={s.modalSearchContainer}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput style={s.modalSearchInput} value={countrySearch} onChangeText={setCountrySearch} placeholder="Search country or currency..." placeholderTextColor="#9CA3AF" />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {filteredCountries.map((c) => (
                <TouchableOpacity key={c.code} style={[s.countryOption, selectedCountry.code === c.code && s.countryOptionSelected]} onPress={() => { setSelectedCountry(c); setShowCountryPicker(false); setCountrySearch(""); }} activeOpacity={0.7}>
                  <Text style={s.countryFlag}>{c.flag}</Text>
                  <View style={s.flex1}>
                    <Text style={s.countryName}>{c.name}</Text>
                    <Text style={s.countryCurrency}>{c.currency} - 1 USD = {c.rate} {c.currency}</Text>
                  </View>
                  {selectedCountry.code === c.code && <Ionicons name="checkmark" size={22} color="#00C6AE" />}
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  flex1: { flex: 1 },

  header: { paddingTop: Platform.OS === "android" ? 40 : 0, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitleContainer: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  placeholder: { width: 40 },
  headerCards: { flexDirection: "row", gap: 12 },
  balanceCard: { flex: 1, padding: 14, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12 },
  balanceLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)" },
  balanceAmount: { fontSize: 20, fontWeight: "700", color: "#FFFFFF", marginTop: 4 },
  rateCard: { flex: 1, padding: 14, backgroundColor: "rgba(0,198,174,0.2)", borderRadius: 12 },
  rateLabel: { fontSize: 11, color: "rgba(255,255,255,0.8)" },
  rateAmount: { fontSize: 13, fontWeight: "600", color: "#FFFFFF", marginTop: 4 },

  scrollContent: { padding: 20, paddingBottom: 140 },

  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  cardError: { borderWidth: 2, borderColor: "#DC2626" },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#0A2342", marginBottom: 14 },

  chipScroll: { marginBottom: 12 },
  chipScrollContent: { gap: 12, paddingRight: 4 },
  chip: { alignItems: "center", gap: 6, padding: 10, paddingHorizontal: 14, backgroundColor: "#F5F7FA", borderRadius: 12, borderWidth: 1, borderColor: "transparent", minWidth: 80 },
  chipSelected: { backgroundColor: "#F0FDFB", borderWidth: 2, borderColor: "#00C6AE" },
  chipAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  chipAvatarSelected: { backgroundColor: "#00C6AE" },
  chipAvatarText: { fontSize: 20 },
  chipName: { fontSize: 11, fontWeight: "500", color: "#0A2342", maxWidth: 70, textAlign: "center" },
  chipNameSelected: { color: "#00897B" },

  addNewForm: { padding: 14, backgroundColor: "#F5F7FA", borderRadius: 12, marginTop: 8, gap: 12 },
  inputGroup: { gap: 6 },
  label: { fontSize: 12, color: "#6B7280" },
  textInput: { backgroundColor: "#FFFFFF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: "#0A2342", borderWidth: 1, borderColor: "#E5E7EB" },
  textInputError: { borderColor: "#DC2626" },
  errorText: { fontSize: 11, color: "#DC2626" },
  phoneRow: { flexDirection: "row", gap: 8 },
  dialCodeButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: "#FFFFFF", borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  dialCodeFlag: { fontSize: 16 },
  dialCodeText: { fontSize: 14, color: "#0A2342" },
  phoneInput: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: "#0A2342", borderWidth: 1, borderColor: "#E5E7EB" },

  selectedBar: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#F0FDFB", borderRadius: 10 },
  selectedAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#00C6AE", alignItems: "center", justifyContent: "center" },
  selectedFlag: { fontSize: 18 },
  selectedName: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  selectedPhone: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  amountGroup: { gap: 6 },
  amountRow: { flexDirection: "row", alignItems: "center", padding: 4, backgroundColor: "#F5F7FA", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  amountRowActive: { backgroundColor: "#F0FDFB", borderWidth: 2, borderColor: "#00C6AE" },
  currencyBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#FFFFFF", borderRadius: 8 },
  currencyFlag: { fontSize: 16 },
  currencyCode: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  amountInput: { flex: 1, fontSize: 24, fontWeight: "700", color: "#0A2342", textAlign: "right", paddingHorizontal: 14, paddingVertical: 12 },
  swapContainer: { alignItems: "center", marginVertical: 8 },
  swapButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F5F7FA", borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  amountError: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 10, backgroundColor: "#FEE2E2", borderRadius: 8 },
  amountErrorText: { fontSize: 12, color: "#DC2626" },

  speedRow: { flexDirection: "row", gap: 10 },
  speedCard: { flex: 1, padding: 14, paddingVertical: 16, backgroundColor: "#F5F7FA", borderRadius: 12, borderWidth: 1, borderColor: "transparent", alignItems: "center" },
  speedCardSelected: { backgroundColor: "#F0FDFB", borderWidth: 2, borderColor: "#00C6AE" },
  speedIcon: { fontSize: 24, marginBottom: 8 },
  speedLabel: { fontSize: 13, fontWeight: "600", color: "#0A2342" },
  speedLabelSelected: { color: "#00897B" },
  speedTime: { fontSize: 10, color: "#6B7280", marginTop: 2, marginBottom: 4 },
  speedFee: { fontSize: 14, fontWeight: "700", color: "#0A2342" },
  speedFeeSelected: { color: "#00C6AE" },

  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: "#6B7280" },
  summaryValue: { fontSize: 13, fontWeight: "500", color: "#0A2342" },
  summaryDivider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },
  summaryTotalLabel: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  summaryTotalValue: { fontSize: 14, fontWeight: "700", color: "#0A2342" },
  summaryReceiveValue: { fontSize: 16, fontWeight: "700", color: "#00C6AE" },

  savingsCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: "#F0FDFB", borderRadius: 10, marginBottom: 16 },
  savingsIcon: { fontSize: 18 },
  savingsText: { flex: 1, fontSize: 12, color: "#065F46" },
  savingsBold: { fontWeight: "700" },

  bottomBar: { padding: 16, paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 34 : 20, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  sendButton: { backgroundColor: "#00C6AE", borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { backgroundColor: "#E5E7EB" },
  sendButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  sendButtonTextDisabled: { color: "#9CA3AF" },
  securityNote: { fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 10 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(10,35,66,0.8)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "75%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342" },
  modalClose: { padding: 4 },
  modalSearchContainer: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F5F7FA", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  modalSearchInput: { flex: 1, fontSize: 14, color: "#0A2342" },
  countryOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#F5F7FA", borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: "transparent" },
  countryOptionSelected: { backgroundColor: "#F0FDFB", borderWidth: 2, borderColor: "#00C6AE" },
  countryFlag: { fontSize: 28 },
  countryName: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  countryCurrency: { fontSize: 12, color: "#6B7280", marginTop: 2 },
});
