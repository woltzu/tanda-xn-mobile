import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useWallet } from "../context/WalletContext";
import { useCurrency, CURRENCIES, CURRENCY_REGIONS } from "../context/CurrencyContext";
import { CurrencySelector, QuickCurrencyPicker } from "../components/CurrencySelector";
import { ExchangeRateDisplay, FXRiskWarning, ConversionCalculator } from "../components/ExchangeRateDisplay";

type RemittanceNavigationProp = StackNavigationProp<RootStackParamList>;

// Country to Currency mapping for auto-currency selection
type CountryData = {
  name: string;
  flag: string;
  currency: string;
  phoneCode: string;
  region: string;
};

const COUNTRIES: Record<string, CountryData> = {
  // West Africa
  SN: { name: "Senegal", flag: "🇸🇳", currency: "XOF", phoneCode: "+221", region: "West Africa" },
  CI: { name: "Côte d'Ivoire", flag: "🇨🇮", currency: "XOF", phoneCode: "+225", region: "West Africa" },
  ML: { name: "Mali", flag: "🇲🇱", currency: "XOF", phoneCode: "+223", region: "West Africa" },
  BF: { name: "Burkina Faso", flag: "🇧🇫", currency: "XOF", phoneCode: "+226", region: "West Africa" },
  BJ: { name: "Benin", flag: "🇧🇯", currency: "XOF", phoneCode: "+229", region: "West Africa" },
  TG: { name: "Togo", flag: "🇹🇬", currency: "XOF", phoneCode: "+228", region: "West Africa" },
  NE: { name: "Niger", flag: "🇳🇪", currency: "XOF", phoneCode: "+227", region: "West Africa" },
  GW: { name: "Guinea-Bissau", flag: "🇬🇼", currency: "XOF", phoneCode: "+245", region: "West Africa" },
  NG: { name: "Nigeria", flag: "🇳🇬", currency: "NGN", phoneCode: "+234", region: "West Africa" },
  GH: { name: "Ghana", flag: "🇬🇭", currency: "GHS", phoneCode: "+233", region: "West Africa" },
  GN: { name: "Guinea", flag: "🇬🇳", currency: "GNF", phoneCode: "+224", region: "West Africa" },
  LR: { name: "Liberia", flag: "🇱🇷", currency: "LRD", phoneCode: "+231", region: "West Africa" },
  SL: { name: "Sierra Leone", flag: "🇸🇱", currency: "SLL", phoneCode: "+232", region: "West Africa" },
  GM: { name: "Gambia", flag: "🇬🇲", currency: "GMD", phoneCode: "+220", region: "West Africa" },

  // Central Africa
  CM: { name: "Cameroon", flag: "🇨🇲", currency: "XAF", phoneCode: "+237", region: "Central Africa" },
  GA: { name: "Gabon", flag: "🇬🇦", currency: "XAF", phoneCode: "+241", region: "Central Africa" },
  CG: { name: "Congo (Brazzaville)", flag: "🇨🇬", currency: "XAF", phoneCode: "+242", region: "Central Africa" },
  CF: { name: "Central African Republic", flag: "🇨🇫", currency: "XAF", phoneCode: "+236", region: "Central Africa" },
  TD: { name: "Chad", flag: "🇹🇩", currency: "XAF", phoneCode: "+235", region: "Central Africa" },
  GQ: { name: "Equatorial Guinea", flag: "🇬🇶", currency: "XAF", phoneCode: "+240", region: "Central Africa" },
  CD: { name: "DR Congo", flag: "🇨🇩", currency: "CDF", phoneCode: "+243", region: "Central Africa" },

  // East Africa
  KE: { name: "Kenya", flag: "🇰🇪", currency: "KES", phoneCode: "+254", region: "East Africa" },
  TZ: { name: "Tanzania", flag: "🇹🇿", currency: "TZS", phoneCode: "+255", region: "East Africa" },
  UG: { name: "Uganda", flag: "🇺🇬", currency: "UGX", phoneCode: "+256", region: "East Africa" },
  RW: { name: "Rwanda", flag: "🇷🇼", currency: "RWF", phoneCode: "+250", region: "East Africa" },
  ET: { name: "Ethiopia", flag: "🇪🇹", currency: "ETB", phoneCode: "+251", region: "East Africa" },
  SO: { name: "Somalia", flag: "🇸🇴", currency: "SOS", phoneCode: "+252", region: "East Africa" },

  // Southern Africa
  ZA: { name: "South Africa", flag: "🇿🇦", currency: "ZAR", phoneCode: "+27", region: "Southern Africa" },
  ZW: { name: "Zimbabwe", flag: "🇿🇼", currency: "ZWL", phoneCode: "+263", region: "Southern Africa" },
  ZM: { name: "Zambia", flag: "🇿🇲", currency: "ZMW", phoneCode: "+260", region: "Southern Africa" },
  MW: { name: "Malawi", flag: "🇲🇼", currency: "MWK", phoneCode: "+265", region: "Southern Africa" },
  MZ: { name: "Mozambique", flag: "🇲🇿", currency: "MZN", phoneCode: "+258", region: "Southern Africa" },
  BW: { name: "Botswana", flag: "🇧🇼", currency: "BWP", phoneCode: "+267", region: "Southern Africa" },
  NA: { name: "Namibia", flag: "🇳🇦", currency: "NAD", phoneCode: "+264", region: "Southern Africa" },

  // North Africa
  MA: { name: "Morocco", flag: "🇲🇦", currency: "MAD", phoneCode: "+212", region: "North Africa" },
  DZ: { name: "Algeria", flag: "🇩🇿", currency: "DZD", phoneCode: "+213", region: "North Africa" },
  TN: { name: "Tunisia", flag: "🇹🇳", currency: "TND", phoneCode: "+216", region: "North Africa" },
  EG: { name: "Egypt", flag: "🇪🇬", currency: "EGP", phoneCode: "+20", region: "North Africa" },

  // Caribbean
  JM: { name: "Jamaica", flag: "🇯🇲", currency: "JMD", phoneCode: "+1-876", region: "Caribbean" },
  HT: { name: "Haiti", flag: "🇭🇹", currency: "HTG", phoneCode: "+509", region: "Caribbean" },
  DO: { name: "Dominican Republic", flag: "🇩🇴", currency: "DOP", phoneCode: "+1-809", region: "Caribbean" },
  TT: { name: "Trinidad & Tobago", flag: "🇹🇹", currency: "TTD", phoneCode: "+1-868", region: "Caribbean" },
  BB: { name: "Barbados", flag: "🇧🇧", currency: "BBD", phoneCode: "+1-246", region: "Caribbean" },
  GY: { name: "Guyana", flag: "🇬🇾", currency: "GYD", phoneCode: "+592", region: "Caribbean" },

  // Central America
  GT: { name: "Guatemala", flag: "🇬🇹", currency: "GTQ", phoneCode: "+502", region: "Central America" },
  HN: { name: "Honduras", flag: "🇭🇳", currency: "HNL", phoneCode: "+504", region: "Central America" },
  SV: { name: "El Salvador", flag: "🇸🇻", currency: "USD", phoneCode: "+503", region: "Central America" },
  NI: { name: "Nicaragua", flag: "🇳🇮", currency: "NIO", phoneCode: "+505", region: "Central America" },

  // South America
  CO: { name: "Colombia", flag: "🇨🇴", currency: "COP", phoneCode: "+57", region: "South America" },
  PE: { name: "Peru", flag: "🇵🇪", currency: "PEN", phoneCode: "+51", region: "South America" },
  EC: { name: "Ecuador", flag: "🇪🇨", currency: "USD", phoneCode: "+593", region: "South America" },
  BR: { name: "Brazil", flag: "🇧🇷", currency: "BRL", phoneCode: "+55", region: "South America" },

  // Asia
  PH: { name: "Philippines", flag: "🇵🇭", currency: "PHP", phoneCode: "+63", region: "Asia" },
  IN: { name: "India", flag: "🇮🇳", currency: "INR", phoneCode: "+91", region: "Asia" },
  PK: { name: "Pakistan", flag: "🇵🇰", currency: "PKR", phoneCode: "+92", region: "Asia" },
  BD: { name: "Bangladesh", flag: "🇧🇩", currency: "BDT", phoneCode: "+880", region: "Asia" },
  VN: { name: "Vietnam", flag: "🇻🇳", currency: "VND", phoneCode: "+84", region: "Asia" },
  NP: { name: "Nepal", flag: "🇳🇵", currency: "NPR", phoneCode: "+977", region: "Asia" },
  LK: { name: "Sri Lanka", flag: "🇱🇰", currency: "LKR", phoneCode: "+94", region: "Asia" },

  // Europe (for sending FROM)
  US: { name: "United States", flag: "🇺🇸", currency: "USD", phoneCode: "+1", region: "North America" },
  FR: { name: "France", flag: "🇫🇷", currency: "EUR", phoneCode: "+33", region: "Europe" },
  GB: { name: "United Kingdom", flag: "🇬🇧", currency: "GBP", phoneCode: "+44", region: "Europe" },
  DE: { name: "Germany", flag: "🇩🇪", currency: "EUR", phoneCode: "+49", region: "Europe" },
  IT: { name: "Italy", flag: "🇮🇹", currency: "EUR", phoneCode: "+39", region: "Europe" },
  ES: { name: "Spain", flag: "🇪🇸", currency: "EUR", phoneCode: "+34", region: "Europe" },
  CA: { name: "Canada", flag: "🇨🇦", currency: "CAD", phoneCode: "+1", region: "North America" },
};

// Group countries by region
const getCountriesByRegion = () => {
  const grouped: Record<string, Array<{ code: string } & CountryData>> = {};
  Object.entries(COUNTRIES).forEach(([code, data]) => {
    if (!grouped[data.region]) {
      grouped[data.region] = [];
    }
    grouped[data.region].push({ code, ...data });
  });
  // Sort countries within each region alphabetically
  Object.keys(grouped).forEach(region => {
    grouped[region].sort((a, b) => a.name.localeCompare(b.name));
  });
  return grouped;
};

// Popular remittance corridors
const POPULAR_CORRIDORS = [
  { from: "USD", to: "XOF", label: "USA to Senegal" },
  { from: "EUR", to: "XOF", label: "France to Senegal" },
  { from: "USD", to: "NGN", label: "USA to Nigeria" },
  { from: "GBP", to: "NGN", label: "UK to Nigeria" },
  { from: "USD", to: "KES", label: "USA to Kenya" },
  { from: "CAD", to: "JMD", label: "Canada to Jamaica" },
  { from: "USD", to: "HTG", label: "USA to Haiti" },
  { from: "EUR", to: "XAF", label: "France to Cameroon" },
];

// Remittance fee structure (flat + percentage)
const REMITTANCE_FEES = {
  standard: { flatFee: 2.99, percentage: 0.5, deliveryDays: "3-5" },
  express: { flatFee: 4.99, percentage: 1.0, deliveryDays: "1-2" },
  instant: { flatFee: 7.99, percentage: 1.5, deliveryDays: "Minutes" },
};

type DeliverySpeed = "standard" | "express" | "instant";

export default function RemittanceScreen() {
  const navigation = useNavigation<RemittanceNavigationProp>();
  const { currencies, getCurrencyBalance, sendRemittance } = useWallet();
  const { primaryCurrency, convert, getExchangeRate, formatCurrency } = useCurrency();

  const [fromCurrency, setFromCurrency] = useState<string>(primaryCurrency);
  const [toCurrency, setToCurrency] = useState<string>("XOF");
  const [amount, setAmount] = useState<string>("");
  const [recipientName, setRecipientName] = useState<string>("");
  const [recipientPhone, setRecipientPhone] = useState<string>("");
  const [recipientCountry, setRecipientCountry] = useState<string>("Senegal");
  const [deliverySpeed, setDeliverySpeed] = useState<DeliverySpeed>("standard");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFromCurrencyPicker, setShowFromCurrencyPicker] = useState(false);
  const [showToCurrencyPicker, setShowToCurrencyPicker] = useState(false);

  // NEW: Country selector state
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("SN"); // Default to Senegal
  const [countrySearchQuery, setCountrySearchQuery] = useState("");

  // NEW: Input mode - "send" means entering amount to send, "receive" means entering amount recipient gets
  const [inputMode, setInputMode] = useState<"send" | "receive">("send");

  // Get exchange rate info
  const exchangeInfo = useMemo(() => {
    return getExchangeRate(fromCurrency, toCurrency);
  }, [fromCurrency, toCurrency]);

  // Calculate amounts based on input mode
  const enteredAmount = parseFloat(amount) || 0;
  const feeStructure = REMITTANCE_FEES[deliverySpeed];

  // Calculate sendAmount and receiveAmount based on input mode
  let sendAmount: number;
  let receiveAmount: number;

  if (inputMode === "send") {
    // User entered amount to send
    sendAmount = enteredAmount;
    receiveAmount = convert(sendAmount, fromCurrency, toCurrency);
  } else {
    // User entered amount recipient should receive - reverse calculate
    receiveAmount = enteredAmount;
    // Convert back: how much do we need to send to get this receive amount?
    sendAmount = convert(receiveAmount, toCurrency, fromCurrency);
  }

  const fee = feeStructure.flatFee + (sendAmount * feeStructure.percentage / 100);
  const totalDebit = sendAmount + fee;

  // Balance check
  const walletBalance = getCurrencyBalance(fromCurrency);
  const hasEnoughBalance = walletBalance >= totalDebit;

  // Available currencies from user's wallets
  const availableSendCurrencies = currencies
    .filter(c => c.isActive && c.balance > 0)
    .map(c => c.code);

  const fromCurrencyInfo = CURRENCIES[fromCurrency];
  const toCurrencyInfo = CURRENCIES[toCurrency];

  // Find country from currency
  const getCountryFromCurrency = (code: string) => {
    const currency = CURRENCIES[code];
    if (!currency) return "";
    // Map currency to common country
    const countryMap: Record<string, string> = {
      XOF: "Senegal",
      XAF: "Cameroon",
      NGN: "Nigeria",
      GHS: "Ghana",
      KES: "Kenya",
      TZS: "Tanzania",
      UGX: "Uganda",
      ZAR: "South Africa",
      JMD: "Jamaica",
      TTD: "Trinidad",
      HTG: "Haiti",
      DOP: "Dominican Republic",
    };
    return countryMap[code] || currency.region;
  };

  // Get selected country data
  const selectedCountryData = COUNTRIES[selectedCountryCode];

  // Handle country selection with AUTO-CURRENCY
  const handleCountrySelect = (countryCode: string) => {
    const country = COUNTRIES[countryCode];
    if (country) {
      setSelectedCountryCode(countryCode);
      setRecipientCountry(country.name);
      // AUTO-SET CURRENCY based on country selection
      setToCurrency(country.currency);
      setShowCountrySelector(false);
      setCountrySearchQuery("");
    }
  };

  // Filter countries by search query
  const filteredCountriesByRegion = useMemo(() => {
    const grouped = getCountriesByRegion();
    if (!countrySearchQuery.trim()) return grouped;

    const query = countrySearchQuery.toLowerCase();
    const filtered: Record<string, Array<{ code: string } & CountryData>> = {};

    Object.entries(grouped).forEach(([region, countries]) => {
      const matches = countries.filter(
        c => c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query)
      );
      if (matches.length > 0) {
        filtered[region] = matches;
      }
    });

    return filtered;
  }, [countrySearchQuery]);

  const handleToCurrencyChange = (code: string) => {
    setToCurrency(code);
    setRecipientCountry(getCountryFromCurrency(code));
  };

  const handleSend = async () => {
    if (!recipientName.trim()) {
      Alert.alert("Missing Information", "Please enter the recipient's name.");
      return;
    }
    if (!recipientPhone.trim()) {
      Alert.alert("Missing Information", "Please enter the recipient's phone number.");
      return;
    }
    if (sendAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter an amount to send.");
      return;
    }
    if (!hasEnoughBalance) {
      Alert.alert(
        "Insufficient Balance",
        `Your ${fromCurrency} wallet balance is not enough for this transfer. Please add funds or reduce the amount.`,
        [{ text: "OK" }]
      );
      return;
    }

    setIsProcessing(true);

    try {
      const transactionId = await sendRemittance(
        sendAmount,
        fromCurrency,
        toCurrency,
        recipientName,
        recipientCountry,
        exchangeInfo.rate,
        fee
      );

      // Navigate to success screen
      navigation.navigate("WalletTransactionSuccess", {
        type: "send",
        amount: sendAmount,
        method: `Remittance to ${recipientCountry}`,
        recipientName,
        transactionId,
      });
    } catch (error) {
      Alert.alert(
        "Transfer Failed",
        "There was an error processing your transfer. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectCorridor = (corridor: { from: string; to: string }) => {
    setFromCurrency(corridor.from);
    setToCurrency(corridor.to);
    setRecipientCountry(getCountryFromCurrency(corridor.to));
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
            <View style={styles.headerTop}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Send Money Abroad</Text>
              <View style={{ width: 40 }} />
            </View>

            <Text style={styles.headerSubtitle}>
              Send money to family and friends worldwide
            </Text>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            {/* Popular Corridors */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular Routes</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.corridorsContainer}
              >
                {POPULAR_CORRIDORS.map((corridor, index) => {
                  const isSelected = fromCurrency === corridor.from && toCurrency === corridor.to;
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.corridorChip, isSelected && styles.corridorChipSelected]}
                      onPress={() => handleSelectCorridor(corridor)}
                    >
                      <View style={styles.corridorFlags}>
                        <Text style={styles.corridorFlag}>{CURRENCIES[corridor.from]?.flag}</Text>
                        <Ionicons name="arrow-forward" size={12} color={isSelected ? "#FFFFFF" : "#9CA3AF"} />
                        <Text style={styles.corridorFlag}>{CURRENCIES[corridor.to]?.flag}</Text>
                      </View>
                      <Text style={[styles.corridorLabel, isSelected && styles.corridorLabelSelected]}>
                        {corridor.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Input Mode Toggle */}
            <View style={styles.inputModeToggle}>
              <TouchableOpacity
                style={[styles.inputModeOption, inputMode === "send" && styles.inputModeOptionActive]}
                onPress={() => {
                  if (inputMode !== "send") {
                    setInputMode("send");
                    setAmount("");
                  }
                }}
              >
                <Ionicons
                  name="arrow-up-circle"
                  size={18}
                  color={inputMode === "send" ? "#00C6AE" : "#9CA3AF"}
                />
                <Text style={[styles.inputModeText, inputMode === "send" && styles.inputModeTextActive]}>
                  I'll enter what I send
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inputModeOption, inputMode === "receive" && styles.inputModeOptionActive]}
                onPress={() => {
                  if (inputMode !== "receive") {
                    setInputMode("receive");
                    setAmount("");
                  }
                }}
              >
                <Ionicons
                  name="arrow-down-circle"
                  size={18}
                  color={inputMode === "receive" ? "#00C6AE" : "#9CA3AF"}
                />
                <Text style={[styles.inputModeText, inputMode === "receive" && styles.inputModeTextActive]}>
                  I'll enter what they receive
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount Input - Send Side */}
            <View style={styles.amountSection}>
              <Text style={styles.sectionTitle}>You Send</Text>
              <View style={[
                styles.amountInputContainer,
                inputMode === "send" && styles.amountInputContainerActive
              ]}>
                <TouchableOpacity
                  style={styles.currencyButton}
                  onPress={() => setShowFromCurrencyPicker(!showFromCurrencyPicker)}
                >
                  <Text style={styles.currencyFlag}>{fromCurrencyInfo?.flag}</Text>
                  <Text style={styles.currencyCode}>{fromCurrency}</Text>
                  <Ionicons name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>
                {inputMode === "send" ? (
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />
                ) : (
                  <Text style={styles.calculatedAmount}>
                    {fromCurrencyInfo?.symbol}{formatCurrency(sendAmount, fromCurrency)}
                  </Text>
                )}
              </View>
              {showFromCurrencyPicker && (
                <QuickCurrencyPicker
                  selectedCurrency={fromCurrency}
                  onSelect={(code) => {
                    setFromCurrency(code);
                    setShowFromCurrencyPicker(false);
                  }}
                  currencies={availableSendCurrencies.length > 0 ? availableSendCurrencies : ["USD", "EUR", "GBP", "CAD"]}
                />
              )}
              <View style={styles.balanceInfo}>
                <Text style={[styles.balanceText, !hasEnoughBalance && styles.balanceTextInsufficient]}>
                  Balance: {fromCurrencyInfo?.symbol}{formatCurrency(walletBalance, fromCurrency)}
                </Text>
                {!hasEnoughBalance && sendAmount > 0 && (
                  <Text style={styles.insufficientWarning}>Insufficient funds</Text>
                )}
              </View>
            </View>

            {/* Exchange Rate Display */}
            <View style={styles.exchangeCard}>
              <View style={styles.exchangeRow}>
                <View style={styles.exchangeArrow}>
                  <Ionicons name="swap-vertical" size={24} color="#00C6AE" />
                </View>
                <View style={styles.exchangeInfo}>
                  <Text style={styles.exchangeLabel}>Exchange Rate</Text>
                  <Text style={styles.exchangeRate}>
                    1 {fromCurrency} = {exchangeInfo.rate.toFixed(exchangeInfo.rate < 1 ? 4 : 2)} {toCurrency}
                  </Text>
                </View>
              </View>
            </View>

            {/* They Receive - Amount Input */}
            <View style={styles.amountSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>They Receive</Text>
                {inputMode === "receive" && (
                  <View style={styles.inputHint}>
                    <Ionicons name="create-outline" size={12} color="#00C6AE" />
                    <Text style={styles.inputHintText}>Enter exact amount</Text>
                  </View>
                )}
              </View>
              <View style={[
                styles.amountInputContainer,
                inputMode === "receive" && styles.amountInputContainerActive
              ]}>
                <TouchableOpacity
                  style={styles.currencyButton}
                  onPress={() => setShowToCurrencyPicker(!showToCurrencyPicker)}
                >
                  <Text style={styles.currencyFlag}>{toCurrencyInfo?.flag}</Text>
                  <Text style={styles.currencyCode}>{toCurrency}</Text>
                  <Ionicons name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>
                {inputMode === "receive" ? (
                  <TextInput
                    style={[styles.amountInput, styles.receiveAmountInput]}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />
                ) : (
                  <Text style={styles.receiveAmount}>
                    {toCurrencyInfo?.symbol}{formatCurrency(receiveAmount, toCurrency)}
                  </Text>
                )}
              </View>
              {showToCurrencyPicker && (
                <QuickCurrencyPicker
                  selectedCurrency={toCurrency}
                  onSelect={(code) => {
                    handleToCurrencyChange(code);
                    setShowToCurrencyPicker(false);
                  }}
                  currencies={["XOF", "NGN", "GHS", "KES", "JMD", "HTG"]}
                />
              )}
              {inputMode === "receive" && enteredAmount > 0 && (
                <Text style={styles.receiveNote}>
                  Your recipient will receive exactly {toCurrencyInfo?.symbol}{formatCurrency(receiveAmount, toCurrency)} {toCurrency}
                </Text>
              )}
            </View>

            {/* Recipient Details */}
            <View style={styles.section}>
              <View style={styles.recipientHeader}>
                <Text style={styles.sectionTitle}>Recipient Details</Text>
                <TouchableOpacity
                  style={styles.savedRecipientsButton}
                  onPress={() => navigation.navigate("SavedRecipients" as any)}
                >
                  <Ionicons name="people" size={14} color="#00C6AE" />
                  <Text style={styles.savedRecipientsText}>Saved Recipients</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputCard}>
                {/* COUNTRY SELECTOR - First for auto-currency */}
                <TouchableOpacity
                  style={styles.inputRow}
                  onPress={() => setShowCountrySelector(true)}
                >
                  <Ionicons name="globe-outline" size={20} color="#6B7280" />
                  <View style={styles.countrySelector}>
                    <Text style={styles.countrySelectorFlag}>
                      {selectedCountryData?.flag || "🌍"}
                    </Text>
                    <View style={styles.countrySelectorInfo}>
                      <Text style={styles.countrySelectorName}>
                        {selectedCountryData?.name || "Select Country"}
                      </Text>
                      <Text style={styles.countrySelectorCurrency}>
                        Currency: {selectedCountryData?.currency || "---"} (auto-selected)
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
                <View style={styles.inputDivider} />
                <View style={styles.inputRow}>
                  <Ionicons name="person-outline" size={20} color="#6B7280" />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Recipient's Full Name"
                    placeholderTextColor="#9CA3AF"
                    value={recipientName}
                    onChangeText={setRecipientName}
                  />
                </View>
                <View style={styles.inputDivider} />
                <View style={styles.inputRow}>
                  <Ionicons name="call-outline" size={20} color="#6B7280" />
                  <View style={styles.phoneInputContainer}>
                    <Text style={styles.phoneCode}>{selectedCountryData?.phoneCode || ""}</Text>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="Phone Number"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                      value={recipientPhone}
                      onChangeText={setRecipientPhone}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Delivery Speed */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Speed</Text>
              <View style={styles.speedOptions}>
                {(Object.entries(REMITTANCE_FEES) as [DeliverySpeed, typeof REMITTANCE_FEES.standard][]).map(([speed, info]) => {
                  const isSelected = deliverySpeed === speed;
                  const speedFee = info.flatFee + (sendAmount * info.percentage / 100);
                  return (
                    <TouchableOpacity
                      key={speed}
                      style={[styles.speedCard, isSelected && styles.speedCardSelected]}
                      onPress={() => setDeliverySpeed(speed)}
                    >
                      <View style={styles.speedHeader}>
                        <Text style={[styles.speedName, isSelected && styles.speedNameSelected]}>
                          {speed.charAt(0).toUpperCase() + speed.slice(1)}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color="#00C6AE" />
                        )}
                      </View>
                      <Text style={styles.speedDelivery}>
                        <Ionicons name="time-outline" size={12} color="#6B7280" /> {info.deliveryDays}
                      </Text>
                      <Text style={styles.speedFee}>
                        Fee: {fromCurrencyInfo?.symbol}{speedFee.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>Transfer Summary</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>You send</Text>
                <Text style={styles.summaryValue}>
                  {fromCurrencyInfo?.symbol}{formatCurrency(sendAmount, fromCurrency)} {fromCurrency}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Transfer fee</Text>
                <Text style={styles.summaryValue}>
                  {fromCurrencyInfo?.symbol}{formatCurrency(fee, fromCurrency)}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Exchange rate</Text>
                <Text style={styles.summaryValue}>
                  1 {fromCurrency} = {exchangeInfo.rate.toFixed(2)} {toCurrency}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total to pay</Text>
                <Text style={styles.totalValue}>
                  {fromCurrencyInfo?.symbol}{formatCurrency(totalDebit, fromCurrency)}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.receiveLabel}>They receive</Text>
                <Text style={styles.receiveValue}>
                  {toCurrencyInfo?.symbol}{formatCurrency(receiveAmount, toCurrency)} {toCurrency}
                </Text>
              </View>
            </View>

            {/* FX Warning */}
            <FXRiskWarning />

            {/* Info Note */}
            <View style={styles.infoNote}>
              <Ionicons name="shield-checkmark" size={18} color="#00897B" />
              <Text style={styles.infoNoteText}>
                Transfers are secure and tracked. Your recipient will receive a notification with pickup instructions.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomSummary}>
          <Text style={styles.bottomLabel}>They receive</Text>
          <Text style={styles.bottomAmount}>
            {toCurrencyInfo?.symbol}{formatCurrency(receiveAmount, toCurrency)}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.sendButton,
            (isProcessing || !hasEnoughBalance || sendAmount <= 0) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={isProcessing || !hasEnoughBalance || sendAmount <= 0}
        >
          {isProcessing ? (
            <Text style={styles.sendButtonText}>Sending...</Text>
          ) : (
            <>
              <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>Send Money</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Country Selector Modal */}
      <Modal
        visible={showCountrySelector}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCountrySelector(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowCountrySelector(false);
                setCountrySearchQuery("");
              }}
            >
              <Ionicons name="close" size={24} color="#0A2342" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Country</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Search */}
          <View style={styles.modalSearchContainer}>
            <Ionicons name="search-outline" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search countries..."
              placeholderTextColor="#9CA3AF"
              value={countrySearchQuery}
              onChangeText={setCountrySearchQuery}
              autoCapitalize="none"
            />
            {countrySearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setCountrySearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Auto-Currency Banner */}
          <View style={styles.autoCurrencyBanner}>
            <Ionicons name="flash" size={16} color="#00897B" />
            <Text style={styles.autoCurrencyText}>
              Currency will be automatically selected based on country
            </Text>
          </View>

          {/* Country List */}
          <ScrollView style={styles.countryList} showsVerticalScrollIndicator={false}>
            {Object.entries(filteredCountriesByRegion).map(([region, countries]) => (
              <View key={region} style={styles.regionSection}>
                <Text style={styles.regionTitle}>{region}</Text>
                {countries.map((country) => {
                  const isSelected = selectedCountryCode === country.code;
                  return (
                    <TouchableOpacity
                      key={country.code}
                      style={[
                        styles.countryItem,
                        isSelected && styles.countryItemSelected,
                      ]}
                      onPress={() => handleCountrySelect(country.code)}
                    >
                      <Text style={styles.countryFlag}>{country.flag}</Text>
                      <View style={styles.countryItemInfo}>
                        <Text style={[
                          styles.countryItemName,
                          isSelected && styles.countryItemNameSelected,
                        ]}>
                          {country.name}
                        </Text>
                        <Text style={styles.countryItemCurrency}>
                          {country.currency} • {country.phoneCode}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color="#00C6AE" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
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
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
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
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 8,
  },
  content: {
    padding: 20,
    paddingBottom: 160,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  recipientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  savedRecipientsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#F0FDFB",
    borderRadius: 8,
  },
  savedRecipientsText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00C6AE",
  },
  corridorsContainer: {
    paddingVertical: 4,
  },
  corridorChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    minWidth: 100,
  },
  corridorChipSelected: {
    backgroundColor: "#00C6AE",
    borderColor: "#00C6AE",
  },
  corridorFlags: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  corridorFlag: {
    fontSize: 16,
  },
  corridorLabel: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
  },
  corridorLabelSelected: {
    color: "#FFFFFF",
  },
  inputModeToggle: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  inputModeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  inputModeOptionActive: {
    backgroundColor: "#F0FDFB",
  },
  inputModeText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  inputModeTextActive: {
    color: "#00C6AE",
    fontWeight: "600",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  inputHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inputHintText: {
    fontSize: 11,
    color: "#00C6AE",
    fontWeight: "500",
  },
  amountSection: {
    marginBottom: 16,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  amountInputContainerActive: {
    borderColor: "#00C6AE",
    borderWidth: 2,
  },
  calculatedAmount: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    color: "#6B7280",
    paddingHorizontal: 16,
    textAlign: "right",
  },
  receiveAmountInput: {
    color: "#00C6AE",
  },
  receiveNote: {
    fontSize: 12,
    color: "#00897B",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  currencyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 8,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  currencyFlag: {
    fontSize: 20,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
    paddingHorizontal: 16,
    textAlign: "right",
  },
  receiveAmount: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    color: "#00C6AE",
    paddingHorizontal: 16,
    textAlign: "right",
  },
  balanceInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  balanceText: {
    fontSize: 12,
    color: "#6B7280",
  },
  balanceTextInsufficient: {
    color: "#F59E0B",
  },
  insufficientWarning: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
  },
  exchangeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  exchangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  exchangeArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  exchangeInfo: {
    flex: 1,
  },
  exchangeLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  exchangeRate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  inputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  inputDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginLeft: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: "#0A2342",
  },
  countryText: {
    fontSize: 15,
    color: "#0A2342",
  },
  speedOptions: {
    flexDirection: "row",
    gap: 10,
  },
  speedCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  speedCardSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  speedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  speedName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  speedNameSelected: {
    color: "#00C6AE",
  },
  speedDelivery: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },
  speedFee: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0A2342",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  receiveLabel: {
    fontSize: 14,
    color: "#00897B",
    fontWeight: "600",
  },
  receiveValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00C6AE",
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginTop: 16,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
    lineHeight: 17,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  bottomSummary: {
    flex: 1,
  },
  bottomLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  bottomAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#00C6AE",
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
    flex: 1.5,
  },
  sendButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Country Selector Styles
  countrySelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  countrySelectorFlag: {
    fontSize: 24,
  },
  countrySelectorInfo: {
    flex: 1,
  },
  countrySelectorName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  countrySelectorCurrency: {
    fontSize: 12,
    color: "#00897B",
    marginTop: 2,
  },
  phoneInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  phoneCode: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
    marginRight: 8,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    color: "#0A2342",
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  modalSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0A2342",
  },
  autoCurrencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDFB",
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  autoCurrencyText: {
    flex: 1,
    fontSize: 13,
    color: "#065F46",
    fontWeight: "500",
  },
  countryList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  regionSection: {
    marginBottom: 20,
  },
  regionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 12,
  },
  countryItemSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  countryFlag: {
    fontSize: 28,
  },
  countryItemInfo: {
    flex: 1,
  },
  countryItemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 2,
  },
  countryItemNameSelected: {
    color: "#00897B",
  },
  countryItemCurrency: {
    fontSize: 12,
    color: "#6B7280",
  },
});
