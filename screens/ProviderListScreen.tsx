// ══════════════════════════════════════════════════════════════════════════════
// ProviderListScreen — browse the Verified Provider Network
// ══════════════════════════════════════════════════════════════════════════════
// Phase 1A entry point. Lists providers with verification_status='verified'
// and is_active=true (RLS does the gating). Filter chips for category,
// country, and minimum rating; tap a card to open ProviderDetailScreen.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import {
  Provider,
  ProviderCategory,
  ProviderFilters,
  useProviderDashboard,
  useProviders,
} from "../hooks/useProviders";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type Nav = StackNavigationProp<RootStackParamList>;
// Phase 1B — when launched from a goal context, the screen carries the
// originating goal id. Each card swaps "View" for "Select this provider"
// which deep-links into the goal→provider payment flow instead of the
// public detail screen.
//
// Marketplace-replace — this screen is also mounted as the MarketStack
// initial route. In that case route.params is undefined and the header
// hides the back button (canGoBack() returns false).
// Phase 2B (templates) — also accepts initialCategory + initialCountry
// so the goal-template post-create provider banner can deep-link with
// the chip strip pre-filtered.
type RouteParams = {
  goalId?: string;
  initialCategory?: ProviderCategory;
  initialCountry?: string;
};

const CATEGORIES: ProviderCategory[] = [
  "construction",
  "education",
  "healthcare",
  "agriculture",
  "retail",
  "legal_finance",
  "services",
  "other",
];

const RATING_OPTIONS = [3, 4, 5];

function verificationLevelLabel(t: any, level: number): string {
  switch (level) {
    case 3:
      return t("provider_list.level_premium");
    case 2:
      return t("provider_list.level_standard");
    default:
      return t("provider_list.level_basic");
  }
}

function verificationLevelColor(level: number): string {
  switch (level) {
    case 3:
      return "#7C3AED";
    case 2:
      return "#059669";
    default:
      return "#00C6AE";
  }
}

export default function ProviderListScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { t } = useTranslation();
  const goalId = route.params?.goalId;
  // Hide the back button when mounted as the MarketStack root — there's
  // nothing to pop. Memoised so changes mid-session don't flicker.
  const canGoBack = useMemo(() => navigation.canGoBack(), [navigation]);
  // Provider-side CTA at the top of the list flips between "Become a
  // provider" and "Provider dashboard" so users who already have a
  // listing don't see the apply CTA again.
  const { isProvider } = useProviderDashboard();

  const [category, setCategory] = useState<ProviderCategory | undefined>(
    route.params?.initialCategory,
  );
  const [country, setCountry] = useState<string | undefined>(
    route.params?.initialCountry,
  );
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  // Inline request-a-provider sheet. Visibility lives here so the
  // footer tile can flip it on without prop-drilling.
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);

  const filters: ProviderFilters = useMemo(
    () => ({ category, country, minRating }),
    [category, country, minRating],
  );

  const { providers, loading, refetch } = useProviders(filters);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Country options derived from what's in the current dataset so the chip
  // strip is not stuck with an empty filter that returns nothing. Cap at 6
  // so the strip stays one-line.
  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of providers) {
      if (p.country) set.add(p.country);
    }
    return Array.from(set).slice(0, 6);
  }, [providers]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
        <Text style={styles.headerTitle}>{t("provider_list.title")}</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      {/* Provider-side CTA. Shown only when the screen is the tab root —
          a goal-context entry already has a focused "Select this
          provider" task and the apply/dashboard CTA would distract. */}
      {!goalId ? (
        <TouchableOpacity
          style={styles.providerCta}
          onPress={() =>
            navigation.navigate(
              isProvider ? "ProviderDashboard" : "ProviderApplication",
            )
          }
          accessibilityRole="button"
        >
          <Ionicons
            name={isProvider ? "speedometer-outline" : "add-circle-outline"}
            size={18}
            color="#0A2342"
          />
          <Text style={styles.providerCtaText}>
            {isProvider
              ? t("provider_list.provider_dashboard_cta")
              : t("provider_list.become_a_provider")}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#6B7280" />
        </TouchableOpacity>
      ) : null}

      <View style={styles.filtersWrap}>
        <Text style={styles.filterLabel}>{t("provider_list.filter_category")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipStrip}>
          <Chip
            label={t("provider_list.filter_all")}
            active={!category}
            onPress={() => setCategory(undefined)}
          />
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={t(`provider_category.${c}`)}
              active={category === c}
              onPress={() => setCategory(category === c ? undefined : c)}
            />
          ))}
        </ScrollView>

        {countryOptions.length > 0 ? (
          <>
            <Text style={styles.filterLabel}>{t("provider_list.filter_country")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipStrip}>
              <Chip
                label={t("provider_list.filter_all")}
                active={!country}
                onPress={() => setCountry(undefined)}
              />
              {countryOptions.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={country === c}
                  onPress={() => setCountry(country === c ? undefined : c)}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.filterLabel}>{t("provider_list.filter_rating")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipStrip}>
          <Chip
            label={t("provider_list.filter_all")}
            active={!minRating}
            onPress={() => setMinRating(undefined)}
          />
          {RATING_OPTIONS.map((r) => (
            <Chip
              key={r}
              label={`${r}+ ★`}
              active={minRating === r}
              onPress={() => setMinRating(minRating === r ? undefined : r)}
            />
          ))}
        </ScrollView>
      </View>

      {loading && providers.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00C6AE" />
        </View>
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C6AE" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="storefront-outline" size={56} color="#9CA3AF" />
              <Text style={styles.emptyText}>{t("provider_list.empty")}</Text>
            </View>
          }
          ListFooterComponent={
            !goalId ? (
              <TouchableOpacity
                style={styles.requestTile}
                onPress={() => setRequestSheetOpen(true)}
                accessibilityRole="button"
              >
                <View style={styles.requestTileIcon}>
                  <Ionicons name="megaphone-outline" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestTileTitle}>
                    {t("provider_list.request_title")}
                  </Text>
                  <Text style={styles.requestTileBody}>
                    {t("provider_list.request_body")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6B7280" />
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => (
            <ProviderCard
              provider={item}
              goalId={goalId}
              onPress={() => navigation.navigate("ProviderDetail", { providerId: item.id })}
              onSelect={
                goalId
                  ? () =>
                      navigation.navigate("GoalProviderPayment", {
                        goalId,
                        providerId: item.id,
                      })
                  : undefined
              }
            />
          )}
        />
      )}

      <ProviderRequestSheet
        visible={requestSheetOpen}
        onClose={() => setRequestSheetOpen(false)}
      />
    </View>
  );
}

// ─── ProviderRequestSheet ───────────────────────────────────────────────────
// Inline modal sheet for the "Request a provider" tile. Collects the
// category + country/city + free-text notes from the user, then fans out
// one notification row per active admin (type = 'provider_request') so
// the existing admin inbox surfaces it. No new schema needed for Phase 1A
// of marketplace-replace — when request volume justifies it, this can be
// promoted to a provider_requests table in a later phase.
function ProviderRequestSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [category, setCategory] = useState<ProviderCategory | null>(null);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset state every time the sheet opens so a previous attempt's
  // input doesn't bleed into the next one.
  useEffect(() => {
    if (!visible) {
      setCategory(null);
      setCountry("");
      setCity("");
      setNotes("");
    }
  }, [visible]);

  const canSubmit =
    !submitting && category !== null && country.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !category) return;
    setSubmitting(true);
    try {
      const { data: admins } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("is_active", true);
      const rows = (admins ?? []).map((a: any) => ({
        user_id: a.user_id,
        type: "provider_request",
        title: "Provider request submitted",
        body:
          `A member asked for a ${category} provider in ${city || "—"}, ${country}.` +
          (notes ? " Notes: " + notes : ""),
        data: {
          requester_id: user?.id ?? null,
          category,
          country,
          city,
          notes,
        },
        read: false,
      }));
      if (rows.length > 0) {
        await supabase.from("notifications").insert(rows);
      }
      onClose();
      Alert.alert(
        t("provider_list.request_success_title"),
        t("provider_list.request_success_body"),
      );
    } catch (e: any) {
      Alert.alert(
        t("provider_list.request_error_title"),
        e?.message ?? t("provider_list.request_error_body"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable style={styles.sheetBackdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t("provider_list.request_title")}</Text>
            <Text style={styles.sheetBody}>{t("provider_list.request_body")}</Text>

            <Text style={styles.sheetLabel}>{t("provider_list.request_category")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipStrip}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, category === c && styles.chipActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                    {t(`provider_category.${c}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.sheetRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetLabel}>{t("provider_list.request_country")}</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={country}
                  onChangeText={setCountry}
                  placeholder="e.g. Mali"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetLabel}>{t("provider_list.request_city")}</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. Bamako"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <Text style={styles.sheetLabel}>{t("provider_list.request_notes")}</Text>
            <TextInput
              style={[styles.sheetInput, styles.sheetInputMultiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t("provider_list.request_notes_placeholder")}
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={300}
            />

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnSecondary]}
                onPress={onClose}
                disabled={submitting}
              >
                <Text style={styles.sheetBtnSecondaryText}>
                  {t("provider_list.request_cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnPrimary, !canSubmit && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.sheetBtnPrimaryText}>
                    {t("provider_list.request_submit")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProviderCard({
  provider,
  goalId,
  onPress,
  onSelect,
}: {
  provider: Provider;
  goalId?: string;
  onPress: () => void;
  onSelect?: () => void;
}) {
  const { t } = useTranslation();
  const locationLine = [provider.city, provider.country].filter(Boolean).join(", ");
  const color = verificationLevelColor(provider.verification_level);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>
          {provider.business_name}
        </Text>
        <View style={[styles.levelBadge, { backgroundColor: `${color}22` }]}>
          <Ionicons name="shield-checkmark-outline" size={12} color={color} />
          <Text style={[styles.levelBadgeText, { color }]}>
            {verificationLevelLabel(t, provider.verification_level)}
          </Text>
        </View>
      </View>
      <Text style={styles.cardCategory}>
        {t(`provider_category.${provider.category}`)}
      </Text>
      {locationLine ? <Text style={styles.cardLocation}>{locationLine}</Text> : null}
      <View style={styles.cardBottom}>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color="#F59E0B" />
          <Text style={styles.ratingText}>
            {provider.rating_count > 0 ? provider.rating_avg.toFixed(1) : "—"}
          </Text>
          <Text style={styles.ratingCount}>
            ({provider.rating_count}) · {provider.total_jobs_completed} {t("provider_list.jobs")}
          </Text>
        </View>
        {/* In a goal context the primary CTA is "Select this provider"
            (jumps straight into the payment flow). The whole card still
            opens the public detail so users can inspect first. */}
        {goalId && onSelect ? (
          <TouchableOpacity
            style={styles.selectBtn}
            onPress={onSelect}
            accessibilityRole="button"
            accessibilityLabel={t("provider_list.select_provider")}
          >
            <Text style={styles.selectBtnText}>{t("provider_list.select_provider")}</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.viewBtn}>
            <Text style={styles.viewBtnText}>{t("provider_list.view")}</Text>
            <Ionicons name="chevron-forward" size={14} color="#00C6AE" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  filtersWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  filterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginTop: 6,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  chipStrip: { flexGrow: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 6,
  },
  chipActive: { backgroundColor: "#0A2342", borderColor: "#0A2342" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#0A2342" },
  chipTextActive: { color: "#FFFFFF" },

  listContent: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, color: "#6B7280" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardName: { flex: 1, fontSize: 15, fontWeight: "700", color: "#0A2342", marginRight: 8 },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  levelBadgeText: { fontSize: 11, fontWeight: "700" },
  cardCategory: { fontSize: 13, color: "#0A2342", fontWeight: "600", marginBottom: 2 },
  cardLocation: { fontSize: 12, color: "#6B7280", marginBottom: 8 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 13, fontWeight: "700", color: "#0A2342" },
  ratingCount: { fontSize: 11, color: "#6B7280", marginLeft: 4 },
  viewBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewBtnText: { fontSize: 13, fontWeight: "700", color: "#00C6AE" },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#00C6AE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  selectBtnText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },

  providerCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  providerCtaText: { flex: 1, fontSize: 14, fontWeight: "700", color: "#0A2342" },

  requestTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 10,
  },
  requestTileIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  requestTileTitle: { fontSize: 14, fontWeight: "800", color: "#0A2342" },
  requestTileBody: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  // ─── Bottom-sheet (ProviderRequestSheet) ─────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: "#0A2342" },
  sheetBody: { fontSize: 13, color: "#6B7280", marginTop: 4, marginBottom: 12 },
  sheetLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0A2342",
    marginTop: 8,
    marginBottom: 6,
  },
  sheetRow: { flexDirection: "row" },
  sheetInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0A2342",
  },
  sheetInputMultiline: { minHeight: 64, textAlignVertical: "top" },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  sheetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBtnPrimary: { backgroundColor: "#00C6AE" },
  sheetBtnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  sheetBtnSecondary: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  sheetBtnSecondaryText: { color: "#0A2342", fontSize: 14, fontWeight: "700" },
});
