import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type AddRecipientNavigationProp = StackNavigationProp<RootStackParamList>;
type AddRecipientRouteProp = RouteProp<RootStackParamList, "AddRecipient">;

type Country = {
  code: string;
  name: string;
  flag: string;
  currency: string;
  dialCode: string;
};

type DeliveryMethod = {
  id: string;
  label: string;
  icon: string;
  providers: string[];
};

const countries: Country[] = [
  { code: "CM", name: "Cameroon", flag: "🇨🇲", currency: "XAF", dialCode: "+237" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN", dialCode: "+234" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES", dialCode: "+254" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", currency: "GHS", dialCode: "+233" },
  { code: "SN", name: "Senegal", flag: "🇸🇳", currency: "XOF", dialCode: "+221" },
  { code: "IN", name: "India", flag: "🇮🇳", currency: "INR", dialCode: "+91" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", currency: "PHP", dialCode: "+63" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", currency: "MXN", dialCode: "+52" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", currency: "COP", dialCode: "+57" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", currency: "BRL", dialCode: "+55" },
];

const deliveryMethods: DeliveryMethod[] = [
  { id: "mobile", label: "Mobile Money", icon: "📱", providers: ["MTN", "Orange Money", "M-Pesa"] },
  { id: "bank", label: "Bank Transfer", icon: "🏦", providers: [] },
  { id: "cash", label: "Cash Pickup", icon: "💵", providers: [] },
];

export default function AddRecipientScreen() {
  const navigation = useNavigation<AddRecipientNavigationProp>();
  const route = useRoute<AddRecipientRouteProp>();
  const { returnTo } = route.params || {};

  // Step state: "country" or "details"
  const [step, setStep] = useState<"country" | "details">("country");
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState("mobile");
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [markFavorite, setMarkFavorite] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCountries = countries.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isValid = fullName.trim().length > 2 && phone.trim().length >= 8;

  const handleBack = () => {
    if (step === "details") {
      setStep("country");
    } else {
      navigation.goBack();
    }
  };

  const handleSelectCountry = (country: Country) => {
    setSelectedCountry(country);
    setStep("details");
    setSearchQuery("");
  };

  const handleSave = () => {
    // Save recipient and go back
    const recipient = {
      id: Date.now().toString(),
      name: fullName.trim(),
      nickname: nickname.trim() || undefined,
      country: selectedCountry?.name,
      countryCode: selectedCountry?.code,
      flag: selectedCountry?.flag,
      phone: `${selectedCountry?.dialCode} ${phone}`,
      email: email.trim() || undefined,
      deliveryMethod,
      isFavorite: markFavorite,
    };

    // TODO: Save to context/storage
    console.log("Saving recipient:", recipient);

    if (returnTo === "beneficiary") {
      // Return to circle creation with recipient data
      navigation.goBack();
    } else {
      navigation.goBack();
    }
  };

  const handleSaveAndSend = () => {
    handleSave();
    // TODO: Navigate to send money flow
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Add Recipient</Text>
              <Text style={styles.headerSubtitle}>
                {step === "country"
                  ? "Select destination country"
                  : `Sending to ${selectedCountry?.name}`}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Step 1: Country Selection */}
          {step === "country" && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Where does this person live?</Text>

              {/* Search */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search countries..."
                  placeholderTextColor="#9CA3AF"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Country List */}
              {filteredCountries.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  style={styles.countryItem}
                  onPress={() => handleSelectCountry(country)}
                >
                  <Text style={styles.countryFlag}>{country.flag}</Text>
                  <View style={styles.countryInfo}>
                    <Text style={styles.countryName}>{country.name}</Text>
                    <Text style={styles.countryDetails}>
                      {country.currency} • {country.dialCode}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ))}

              {filteredCountries.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="search" size={40} color="#9CA3AF" />
                  <Text style={styles.emptyStateText}>No countries found</Text>
                </View>
              )}
            </View>
          )}

          {/* Step 2: Recipient Details */}
          {step === "details" && selectedCountry && (
            <>
              {/* Selected Country */}
              <View style={styles.selectedCountryCard}>
                <Text style={styles.selectedCountryFlag}>{selectedCountry.flag}</Text>
                <View style={styles.selectedCountryInfo}>
                  <Text style={styles.selectedCountryName}>{selectedCountry.name}</Text>
                  <Text style={styles.selectedCountryCurrency}>{selectedCountry.currency}</Text>
                </View>
                <TouchableOpacity
                  style={styles.changeButton}
                  onPress={() => setStep("country")}
                >
                  <Text style={styles.changeButtonText}>Change</Text>
                </TouchableOpacity>
              </View>

              {/* Delivery Method */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Delivery Method</Text>
                <View style={styles.deliveryMethodsRow}>
                  {deliveryMethods.map((method) => (
                    <TouchableOpacity
                      key={method.id}
                      style={[
                        styles.deliveryMethodButton,
                        deliveryMethod === method.id && styles.deliveryMethodButtonSelected,
                      ]}
                      onPress={() => setDeliveryMethod(method.id)}
                    >
                      <Text style={styles.deliveryMethodIcon}>{method.icon}</Text>
                      <Text
                        style={[
                          styles.deliveryMethodLabel,
                          deliveryMethod === method.id && styles.deliveryMethodLabelSelected,
                        ]}
                      >
                        {method.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Recipient Information */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recipient Information</Text>

                {/* Full Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name (as registered) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Enter recipient's full name"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="words"
                  />
                </View>

                {/* Nickname */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nickname (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={nickname}
                    onChangeText={setNickname}
                    placeholder="e.g., Mama, Uncle John"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {/* Phone */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number *</Text>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.dialCodeBox}>
                      <Text style={styles.dialCodeFlag}>{selectedCountry.flag}</Text>
                      <Text style={styles.dialCodeText}>{selectedCountry.dialCode}</Text>
                    </View>
                    <TextInput
                      style={[styles.textInput, styles.phoneInput]}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="Phone number"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Email */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="For email notifications"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Mark as Favorite */}
              <TouchableOpacity
                style={styles.favoriteButton}
                onPress={() => setMarkFavorite(!markFavorite)}
              >
                <View
                  style={[
                    styles.favoriteCheckbox,
                    markFavorite && styles.favoriteCheckboxChecked,
                  ]}
                >
                  {markFavorite && <Text style={styles.favoriteCheckboxStar}>⭐</Text>}
                </View>
                <View style={styles.favoriteText}>
                  <Text style={styles.favoriteTitle}>Add to Favorites</Text>
                  <Text style={styles.favoriteSubtitle}>Quick access when sending money</Text>
                </View>
              </TouchableOpacity>

              {/* Tip */}
              <View style={styles.tipCard}>
                <Ionicons name="information-circle" size={18} color="#00897B" />
                <Text style={styles.tipText}>
                  <Text style={styles.tipBold}>Tip:</Text> Make sure the name matches exactly
                  how it's registered with the mobile money or bank account.
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom Actions - Only show on details step */}
      {step === "details" && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, !isValid && styles.primaryButtonDisabled]}
            onPress={handleSaveAndSend}
            disabled={!isValid}
          >
            <Text
              style={[
                styles.primaryButtonText,
                !isValid && styles.primaryButtonTextDisabled,
              ]}
            >
              Save & Send Money
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSave}
            disabled={!isValid}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                !isValid && styles.secondaryButtonTextDisabled,
              ]}
            >
              Save for Later
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  content: {
    padding: 20,
    paddingBottom: 180,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 14,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0A2342",
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    marginBottom: 10,
  },
  countryFlag: {
    fontSize: 32,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  countryDetails: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 12,
  },
  selectedCountryCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectedCountryFlag: {
    fontSize: 28,
  },
  selectedCountryInfo: {
    flex: 1,
  },
  selectedCountryName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  selectedCountryCurrency: {
    fontSize: 11,
    color: "#065F46",
    marginTop: 2,
  },
  changeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  changeButtonText: {
    fontSize: 11,
    color: "#6B7280",
  },
  deliveryMethodsRow: {
    flexDirection: "row",
    gap: 8,
  },
  deliveryMethodButton: {
    flex: 1,
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
  },
  deliveryMethodButtonSelected: {
    backgroundColor: "#F0FDFB",
    borderWidth: 2,
    borderColor: "#00C6AE",
  },
  deliveryMethodIcon: {
    fontSize: 22,
  },
  deliveryMethodLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
  },
  deliveryMethodLabelSelected: {
    fontWeight: "600",
    color: "#00897B",
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 6,
  },
  textInput: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    fontSize: 14,
    color: "#0A2342",
    backgroundColor: "#FFFFFF",
  },
  phoneInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  dialCodeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 14,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
  },
  dialCodeFlag: {
    fontSize: 16,
  },
  dialCodeText: {
    fontSize: 14,
    color: "#0A2342",
  },
  phoneInput: {
    flex: 1,
  },
  favoriteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  favoriteCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteCheckboxChecked: {
    borderWidth: 0,
    backgroundColor: "#F59E0B",
  },
  favoriteCheckboxStar: {
    fontSize: 12,
  },
  favoriteText: {
    flex: 1,
  },
  favoriteTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0A2342",
  },
  favoriteSubtitle: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  tipCard: {
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
    lineHeight: 18,
  },
  tipBold: {
    fontWeight: "700",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  primaryButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  primaryButtonTextDisabled: {
    color: "#9CA3AF",
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  secondaryButtonTextDisabled: {
    color: "#D1D5DB",
  },
});
