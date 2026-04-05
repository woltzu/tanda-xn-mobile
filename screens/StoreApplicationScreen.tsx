import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useMarketplaceActions, type StoreCategory } from "../hooks/useMarketplace";

const CATEGORIES: { key: StoreCategory; icon: string; color: string; label: string }[] = [
  { key: "food", icon: "restaurant", color: "#F59E0B", label: "Food & Catering" },
  { key: "beauty", icon: "cut", color: "#EC4899", label: "Beauty & Hair" },
  { key: "travel", icon: "airplane", color: "#3B82F6", label: "Travel & Trips" },
  { key: "shipping", icon: "cube", color: "#8B5CF6", label: "Shipping & Freight" },
  { key: "finance", icon: "cash", color: "#10B981", label: "Financial Services" },
  { key: "events", icon: "calendar", color: "#F97316", label: "Events & Planning" },
  { key: "realestate", icon: "home", color: "#6366F1", label: "Real Estate" },
  { key: "health", icon: "heart", color: "#EF4444", label: "Health & Wellness" },
  { key: "other", icon: "ellipsis-horizontal", color: "#6B7280", label: "Other" },
];

export default function StoreApplicationScreen() {
  const navigation = useNavigation<any>();
  const { createStore, creating } = useMarketplaceActions();

  const [step, setStep] = useState(0);

  // Step 0: Category
  const [category, setCategory] = useState<StoreCategory | null>(null);

  // Step 1: Business Info
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: Discount & Offer
  const [memberDiscount, setMemberDiscount] = useState(true);
  const [discountPct, setDiscountPct] = useState("10");
  const [exclusiveOffer, setExclusiveOffer] = useState("");

  const handleNext = () => {
    if (step === 0 && !category) {
      Alert.alert("Required", "Please select a category");
      return;
    }
    if (step === 1) {
      if (!businessName.trim()) { Alert.alert("Required", "Business name is required"); return; }
      if (!ownerName.trim()) { Alert.alert("Required", "Your name is required"); return; }
      if (!phone.trim()) { Alert.alert("Required", "Phone number is required"); return; }
      if (!city.trim()) { Alert.alert("Required", "City is required"); return; }
    }
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    try {
      const store = await createStore({
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        state: state.trim() || undefined,
        category: category!,
        description: description.trim() || undefined,
        memberDiscountPct: memberDiscount ? parseInt(discountPct) || 10 : 0,
        exclusiveOffer: exclusiveOffer.trim() || undefined,
      });
      Alert.alert(
        "Welcome to the Marketplace! 🎉",
        "Your store is live. Add your services next to start receiving bookings.",
        [{ text: "Set Up Services", onPress: () => navigation.replace("OwnerDashboard", { storeId: store.id }) }]
      );
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not create store");
    }
  };

  const selectedCat = CATEGORIES.find(c => c.key === category);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => step > 0 ? setStep(step - 1) : navigation.goBack()}>
            <Ionicons name={step > 0 ? "arrow-back" : "close"} size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>List Your Business</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Progress */}
        <View style={styles.progressRow}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>
          {step === 0 ? "What do you offer?" : step === 1 ? "Business Details" : "Member Benefits"}
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          {/* Step 0: Category Selection */}
          {step === 0 && (
            <>
              <Text style={styles.sectionLabel}>Select your category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryCard,
                      category === cat.key && { borderColor: cat.color, backgroundColor: cat.color + "10" },
                    ]}
                    onPress={() => setCategory(cat.key)}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: cat.color + "20" }]}>
                      <Ionicons name={cat.icon as any} size={24} color={cat.color} />
                    </View>
                    <Text style={[styles.categoryLabel, category === cat.key && { color: cat.color }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Verification notice for finance & realestate */}
              {(category === "finance" || category === "realestate") && (
                <View style={styles.noticeCard}>
                  <Ionicons name="shield-checkmark" size={18} color="#3B82F6" />
                  <Text style={styles.noticeText}>
                    {category === "finance" ? "Financial Services" : "Real Estate"} providers require verification. You'll be able to submit documentation after listing.
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Step 1: Business Details */}
          {step === 1 && (
            <>
              <Text style={styles.sectionLabel}>Tell us about your business</Text>
              <TextInput
                style={styles.input}
                placeholder="Business name"
                placeholderTextColor="#9CA3AF"
                value={businessName}
                onChangeText={setBusinessName}
              />
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor="#9CA3AF"
                value={ownerName}
                onChangeText={setOwnerName}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.input, { flex: 2 }]}
                  placeholder="City"
                  placeholderTextColor="#9CA3AF"
                  value={city}
                  onChangeText={setCity}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="State"
                  placeholderTextColor="#9CA3AF"
                  value={state}
                  onChangeText={setState}
                  maxLength={2}
                  autoCapitalize="characters"
                />
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your business (optional)"
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={500}
              />
            </>
          )}

          {/* Step 2: Member Benefits */}
          {step === 2 && (
            <>
              <Text style={styles.sectionLabel}>Offer something special to members</Text>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Member discount</Text>
                  <Text style={styles.switchHint}>Give TandaXn circle members a special rate</Text>
                </View>
                <Switch value={memberDiscount} onValueChange={setMemberDiscount} trackColor={{ true: "#00C6AE" }} />
              </View>

              {memberDiscount && (
                <View style={styles.discountRow}>
                  <Text style={styles.discountLabel}>Discount</Text>
                  <View style={styles.discountPicker}>
                    {["5", "10", "15", "20"].map(pct => (
                      <TouchableOpacity
                        key={pct}
                        style={[styles.discountBtn, discountPct === pct && styles.discountBtnActive]}
                        onPress={() => setDiscountPct(pct)}
                      >
                        <Text style={[styles.discountBtnText, discountPct === pct && { color: "#FFFFFF" }]}>
                          {pct}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Exclusive offer or message (optional)"
                placeholderTextColor="#9CA3AF"
                value={exclusiveOffer}
                onChangeText={setExclusiveOffer}
                multiline
                maxLength={200}
              />

              {/* Preview Card */}
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Preview</Text>
                <View style={styles.previewStore}>
                  <View style={styles.previewAvatar}>
                    <Ionicons name={selectedCat?.icon as any ?? "storefront"} size={24} color={selectedCat?.color ?? "#6B7280"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewName}>{businessName || "Your Business"}</Text>
                    <Text style={styles.previewMeta}>{city || "City"}{state ? `, ${state}` : ""}</Text>
                    {memberDiscount && (
                      <View style={styles.previewDiscount}>
                        <Ionicons name="pricetag" size={12} color="#00C6AE" />
                        <Text style={styles.previewDiscountText}>{discountPct}% member discount</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Trust signals */}
              <View style={styles.trustRow}>
                {["Free to list", "No credit card", "Edit anytime"].map(text => (
                  <View key={text} style={styles.trustItem}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={styles.trustText}>{text}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        {step < 2 ? (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitBtn, creating && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={creating}
          >
            <Ionicons name="storefront" size={18} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>{creating ? "Creating..." : "Create My Store"}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  progressRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 8 },
  progressDot: { width: 32, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },
  progressDotActive: { backgroundColor: "#00C6AE" },
  stepLabel: { fontSize: 14, color: "rgba(255,255,255,0.7)", textAlign: "center" },
  content: { flex: 1, padding: 20 },

  sectionLabel: { fontSize: 17, fontWeight: "600", color: "#0A2342", marginBottom: 16, marginTop: 4 },

  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  categoryCard: { width: "31%", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 2, borderColor: "#E5E7EB", alignItems: "center" },
  categoryIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  categoryLabel: { fontSize: 11, fontWeight: "600", color: "#0A2342", textAlign: "center" },

  noticeCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: "#BFDBFE" },
  noticeText: { flex: 1, fontSize: 13, color: "#1E40AF", lineHeight: 18 },

  input: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, fontSize: 15, color: "#0A2342", borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  rowInputs: { flexDirection: "row", gap: 10 },

  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10 },
  switchLabel: { fontSize: 14, fontWeight: "500", color: "#0A2342" },
  switchHint: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  discountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  discountLabel: { fontSize: 14, fontWeight: "500", color: "#0A2342" },
  discountPicker: { flexDirection: "row", gap: 8 },
  discountBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
  discountBtnActive: { backgroundColor: "#00C6AE", borderColor: "#00C6AE" },
  discountBtnText: { fontSize: 14, fontWeight: "600", color: "#0A2342" },

  previewCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginTop: 20, borderWidth: 1, borderColor: "#E5E7EB" },
  previewTitle: { fontSize: 13, fontWeight: "600", color: "#9CA3AF", marginBottom: 12 },
  previewStore: { flexDirection: "row", alignItems: "center" },
  previewAvatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#F0FDFB", alignItems: "center", justifyContent: "center", marginRight: 14 },
  previewName: { fontSize: 16, fontWeight: "600", color: "#0A2342", marginBottom: 2 },
  previewMeta: { fontSize: 12, color: "#9CA3AF", marginBottom: 4 },
  previewDiscount: { flexDirection: "row", alignItems: "center", gap: 4 },
  previewDiscountText: { fontSize: 12, fontWeight: "600", color: "#00C6AE" },

  trustRow: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 20 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  trustText: { fontSize: 12, color: "#6B7280" },

  bottomBar: { padding: 20, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#0A2342", borderRadius: 14, paddingVertical: 16 },
  nextBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#00C6AE", borderRadius: 14, paddingVertical: 16 },
  submitBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
