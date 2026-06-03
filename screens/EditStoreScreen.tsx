// ══════════════════════════════════════════════════════════════════════════════
// screens/EditStoreScreen.tsx — Store owner edits business name, description, category
// ══════════════════════════════════════════════════════════════════════════════
//
// Route param: { storeId: string }
//
// Fetches the current store via useOwnerDashboard(storeId) (reuses the same
// hook OwnerDashboard uses, no extra fetch path). Persists via
// useMarketplaceActions().updateStore(...) which hits
// MarketplaceEngine.updateStore → Supabase marketplace_stores table.
//
// Three fields editable in this version: business name, description,
// category. Cover photo is intentionally deferred (the spec marked it
// future-enhancement; doing it well needs MediaUploadService wiring).
//
// Category note: the DB CHECK constraint allows only nine values
// (food / beauty / travel / shipping / finance / events / realestate /
// health / other). The original spec proposed labels "Retail/Services/..."
// that aren't in the constraint; using those would fail on save. UI shows
// human-friendly labels mapped onto the schema enum.
//
// On save: Alert("Store updated") → goBack. OwnerDashboard refreshes its
// data on focus (or manually via pull-to-refresh), so no return-param hack
// needed.
//
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useFormDraft } from "../hooks/useFormDraft";
import { Routes } from "../lib/routes";
import { useOwnerDashboard, useMarketplaceActions } from "../hooks/useMarketplace";
import type { StoreCategory } from "../services/MarketplaceEngine";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type EditStoreRouteParams = { storeId: string };
type EditStoreRouteProp = RouteProp<{ EditStore: EditStoreRouteParams }, "EditStore">;

// Human-friendly labels mapped onto the schema's enum. Order chosen so the
// commonest categories sit at the top of the picker.
const CATEGORY_OPTIONS: { value: StoreCategory; label: string; emoji: string }[] = [
  { value: "food", label: "Food & Drink", emoji: "🍽️" },
  { value: "beauty", label: "Beauty & Salons", emoji: "💇" },
  { value: "travel", label: "Travel", emoji: "✈️" },
  { value: "shipping", label: "Shipping & Logistics", emoji: "📦" },
  { value: "finance", label: "Finance", emoji: "💰" },
  { value: "events", label: "Events", emoji: "🎉" },
  { value: "realestate", label: "Real Estate", emoji: "🏠" },
  { value: "health", label: "Health & Wellness", emoji: "🩺" },
  { value: "other", label: "Other", emoji: "✨" },
];

export default function EditStoreScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<EditStoreRouteProp>();
  const storeId = route.params?.storeId ?? "";

  const { dashboard, loading: fetching } = useOwnerDashboard(storeId);
  const { updateStore } = useMarketplaceActions();

  const store = dashboard?.store;

  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<StoreCategory>("other");
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // ── Auto-save draft ──────────────────────────────────────────────────────
  // Per-store key so two stores edited from the same device don't share a
  // draft. coverPhotoUri intentionally omitted — the screen has no image-
  // picker state today, so there's nothing to persist.
  type EditStoreDraft = {
    businessName: string;
    description: string;
    category: StoreCategory;
  };
  const { saveDraft, restoreDraft, clearDraft } = useFormDraft<EditStoreDraft>(
    `edit-store-${storeId}`,
    {
      businessName: "",
      description: "",
      category: "other",
    }
  );
  const isFirstDraftRender = useRef(true);
  // One-shot restore. WITHOUT this guard, the restore effect would re-fire
  // every time saveDraft updates the hook's internal draft state (since
  // restoreDraft's callback identity depends on the loaded draft). That
  // would clobber live keystrokes mid-typing.
  const hasRestoredDraft = useRef(false);
  useEffect(() => {
    if (hasRestoredDraft.current) return;
    const d = restoreDraft();
    if (d) {
      setBusinessName(d.businessName);
      setDescription(d.description);
      setCategory(d.category);
      // Mark hydrated so the existing store-fetch hydration below skips
      // — draft (user's most recent edits) wins over fetched DB values.
      setHydrated(true);
      hasRestoredDraft.current = true;
    }
  }, [restoreDraft]);

  // Hydrate form state once the store data lands. The hook re-renders when
  // dashboard changes; we only seed on first arrival so user edits aren't
  // clobbered by a stale background re-fetch. If a draft was restored
  // above, this is already a no-op (hydrated is already true).
  useEffect(() => {
    if (store && !hydrated) {
      setBusinessName(store.businessName ?? "");
      setDescription(store.description ?? "");
      setCategory(store.category ?? "other");
      setHydrated(true);
    }
  }, [store, hydrated]);

  // Debounced save on every change. Skip first render so default values
  // don't clobber a freshly loaded draft before restore fires.
  useEffect(() => {
    if (isFirstDraftRender.current) {
      isFirstDraftRender.current = false;
      return;
    }
    saveDraft({
      businessName,
      description,
      category,
    });
  }, [businessName, description, category, saveDraft]);
  // ──────────────────────────────────────────────────────────────────────────

  // Computed: has the form been dirtied vs the loaded store?
  const isDirty = useMemo(() => {
    if (!store) return false;
    return (
      businessName.trim() !== (store.businessName ?? "") ||
      description.trim() !== (store.description ?? "") ||
      category !== store.category
    );
  }, [businessName, description, category, store]);

  const handleSave = async () => {
    if (!businessName.trim()) {
      Alert.alert("Business name required", "Please enter a name for your store.");
      return;
    }
    if (!storeId) {
      Alert.alert("Error", "Missing store ID. Please go back and try again.");
      return;
    }

    setSaving(true);
    try {
      await updateStore(storeId, {
        businessName: businessName.trim(),
        description: description.trim() || undefined,
        category,
      });
      // Clear draft now that the update is persisted server-side.
      // Cancel intentionally does NOT clear — the user may want to
      // resume editing later from the same partial state.
      clearDraft();
      Alert.alert("Store updated", "Your changes are live.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      console.error("[EditStore] updateStore failed:", err);
      Alert.alert("Could not save", err?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      Alert.alert(
        "Discard changes?",
        "You have unsaved changes.",
        [
          { text: "Keep editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => navigation.goBack() },
        ],
      );
    } else {
      navigation.goBack();
    }
  };

  // Loading state — block UI until store data arrives, otherwise the form
  // would render with empty defaults the user might unknowingly submit.
  if (fetching && !store) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={NAVY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Store</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingText}>Loading your store…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state — store fetch returned null. Surface and offer goBack.
  if (!store) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={NAVY} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Store</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={MUTED} />
          <Text style={styles.errorTitle}>Store not found</Text>
          <Text style={styles.errorBody}>
            We couldn't load your store. Pull back and try again.
          </Text>
          <TouchableOpacity style={styles.outlineButton} onPress={() => navigation.goBack()}>
            <Text style={styles.outlineButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Ionicons name="chevron-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Store</Text>
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
          {/* Business name */}
          <View style={styles.field}>
            <Text style={styles.label}>Store name</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Aminata's Catering"
              placeholderTextColor="#9CA3AF"
              maxLength={120}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Tell customers what you offer…"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.helperText}>{description.length} / 500</Text>
          </View>

          {/* Category — chip picker (DB enum, friendly labels) */}
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipGrid}>
              {CATEGORY_OPTIONS.map((opt) => {
                const selected = category === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setCategory(opt.value)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Cover photo — deferred per spec */}
          <View style={styles.field}>
            <Text style={styles.label}>Cover photo</Text>
            <View style={styles.placeholderBox}>
              <Ionicons name="image-outline" size={24} color={MUTED} />
              <Text style={styles.placeholderText}>Coming soon</Text>
            </View>
          </View>

          {/* Footer action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={handleCancel}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.outlineButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveButton,
                (!isDirty || saving) && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!isDirty || saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isDirty || saving }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save changes</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Currently-non-editable info shown for context. Phone/city/owner
              name are set on store creation and aren't part of this screen's
              v1 scope — surfaced here so the owner sees what's stable. */}
          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>Other store details</Text>
            <Text style={styles.metaRow}>Owner: {store.ownerName || "—"}</Text>
            <Text style={styles.metaRow}>Phone: {store.phone || "—"}</Text>
            <Text style={styles.metaRow}>City: {store.city || "—"}</Text>
            <Text style={styles.metaHint}>
              These fields aren't editable here yet. Contact support if you need to update them.
            </Text>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: { fontSize: 14, color: MUTED, marginTop: 8 },
  errorTitle: { fontSize: 18, fontWeight: "600", color: NAVY, marginTop: 8 },
  errorBody: { fontSize: 14, color: MUTED, textAlign: "center" },
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
  textArea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  helperText: {
    marginTop: 4,
    fontSize: 12,
    color: MUTED,
    textAlign: "right",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  chipSelected: {
    backgroundColor: "rgba(0, 198, 174, 0.12)",
    borderColor: TEAL,
  },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 13, color: NAVY },
  chipTextSelected: { fontWeight: "600", color: TEAL },
  placeholderBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "dashed",
    borderRadius: 8,
  },
  placeholderText: { fontSize: 13, color: MUTED, fontStyle: "italic" },
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
  metaCard: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  metaTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 8,
  },
  metaRow: { fontSize: 13, color: NAVY, marginBottom: 4 },
  metaHint: {
    fontSize: 12,
    color: MUTED,
    fontStyle: "italic",
    marginTop: 4,
  },
});
