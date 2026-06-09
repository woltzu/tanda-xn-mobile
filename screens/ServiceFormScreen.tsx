// ══════════════════════════════════════════════════════════════════════════════
// screens/ServiceFormScreen.tsx — Modal add/edit form for a store service
// ══════════════════════════════════════════════════════════════════════════════
//
// Route params: { storeId: string; service?: StoreService }
//
// Modal-presented from ManageServicesScreen. If `service` is provided, the
// form opens in edit mode (seeded from the passed object); otherwise it's
// a new-service flow.
//
// On save, calls useMarketplaceActions().addService or .updateService
// (the real MarketplaceEngine wires to store_services table). On success,
// goBack — the parent ManageServicesScreen re-fetches via useFocusEffect.
// No callback plumbing needed.
//
// Field mapping:
//   - UI "name"        → schema name (required)
//   - UI "price"       → schema priceCents (parsed dollars → cents)
//   - UI "duration"    → schema durationMinutes (parsed integer)
//   - UI "description" → schema description (optional)
//
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useMarketplaceActions } from "../hooks/useMarketplace";
import type { StoreService } from "../services/MarketplaceEngine";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type ServiceFormRouteParams = {
  storeId: string;
  service?: StoreService;
};

type ServiceFormRouteProp = RouteProp<
  { ServiceForm: ServiceFormRouteParams },
  "ServiceForm"
>;

export default function ServiceFormScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<ServiceFormRouteProp>();
  const { t } = useTranslation();
  const { storeId, service } = route.params ?? { storeId: "" };

  const isEditing = !!service;
  const { addService, updateService } = useMarketplaceActions();

  // Seed from existing service if editing; otherwise empty form.
  // priceCents -> dollars string for the input (no $ symbol, no thousands separators).
  const [name, setName] = useState(service?.name ?? "");
  const [price, setPrice] = useState(
    service?.priceCents != null ? (service.priceCents / 100).toFixed(2) : "",
  );
  const [duration, setDuration] = useState(
    service?.durationMinutes != null ? String(service.durationMinutes) : "",
  );
  const [description, setDescription] = useState(service?.description ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    // Validate required fields
    if (!name.trim()) {
      Alert.alert(t("service_form.alert_name_required_title"), t("service_form.alert_name_required_body"));
      return;
    }
    const priceNum = parseFloat(price);
    if (!price || isNaN(priceNum) || priceNum < 0) {
      Alert.alert(t("service_form.alert_price_required_title"), t("service_form.alert_price_required_body"));
      return;
    }
    const priceCents = Math.round(priceNum * 100);

    // Optional duration: parse if present, else undefined.
    let durationMinutes: number | undefined;
    if (duration.trim()) {
      const d = parseInt(duration, 10);
      if (isNaN(d) || d <= 0) {
        Alert.alert(
          "Invalid duration",
          "Enter the duration in minutes (e.g. 30 or 60), or leave blank.",
        );
        return;
      }
      durationMinutes = d;
    }

    if (!storeId) {
      Alert.alert(t("service_form.alert_error"), t("service_form.alert_missing_store"));
      return;
    }

    setSaving(true);
    try {
      if (isEditing && service) {
        await updateService(service.id, {
          name: name.trim(),
          priceCents,
          durationMinutes,
          description: description.trim() || undefined,
        });
      } else {
        await addService(storeId, {
          name: name.trim(),
          priceCents,
          durationMinutes,
          description: description.trim() || undefined,
        });
      }
      // Pop back to ManageServicesScreen — its useFocusEffect will
      // re-fetch and the new/updated row will show.
      navigation.goBack();
    } catch (err: any) {
      console.error("[ServiceForm] save failed:", err);
      Alert.alert(
        "Could not save",
        err?.message ?? "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header — modal close on the right is more conventional for modal
          presentation; back-style chevron on the left also works. Keeping
          the chevron pattern for consistency with the rest of the app. */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Ionicons name="close" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? "Edit Service" : "Add Service"}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Service name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t("service_form.placeholder_consultation")}
              placeholderTextColor="#9CA3AF"
              maxLength={120}
            />
          </View>

          {/* Price */}
          <View style={styles.field}>
            <Text style={styles.label}>Price (USD) *</Text>
            <View style={styles.priceRow}>
              <Text style={styles.pricePrefix}>$</Text>
              <TextInput
                style={[styles.input, styles.priceInput]}
                value={price}
                onChangeText={setPrice}
                placeholder={t("service_form.placeholder_price")}
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                maxLength={10}
              />
            </View>
            <Text style={styles.helperText}>
              Enter the price customers will see.
            </Text>
          </View>

          {/* Duration (optional) */}
          <View style={styles.field}>
            <Text style={styles.label}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={setDuration}
              placeholder={t("service_form.placeholder_duration")}
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={5}
            />
            <Text style={styles.helperText}>
              Leave blank for services without a fixed duration.
            </Text>
          </View>

          {/* Description (optional) */}
          <View style={styles.field}>
            <Text style={styles.label}>{t("service_form.label_description")}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t("service_form.placeholder_description")}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.helperText}>{description.length} / 500</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={() => navigation.goBack()}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.outlineButtonText}>{t("service_form.btn_cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isEditing ? "Save changes" : "Add service"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "#FFFFFF",
  },
  backButton: { minWidth: 44, paddingVertical: 4 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: NAVY,
  },
  headerSpacer: { width: 44 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 320 },
  field: { marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: NAVY,
  },
  textArea: { minHeight: 96, textAlignVertical: "top" },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
  },
  pricePrefix: {
    paddingLeft: 12,
    paddingRight: 4,
    fontSize: 16,
    color: NAVY,
    fontWeight: "600",
  },
  priceInput: {
    flex: 1,
    borderWidth: 0,
    paddingLeft: 0,
  },
  helperText: {
    marginTop: 4,
    fontSize: 12,
    color: MUTED,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  outlineButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  outlineButtonText: { fontSize: 15, color: NAVY, fontWeight: "600" },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  saveButtonDisabled: { backgroundColor: "#9CA3AF" },
  saveButtonText: { fontSize: 15, color: "#FFFFFF", fontWeight: "700" },
});
