// ══════════════════════════════════════════════════════════════════════════════
// ProviderListScreen — browse the Verified Provider Network
// ══════════════════════════════════════════════════════════════════════════════
// Phase 1A entry point. Lists providers with verification_status='verified'
// and is_active=true (RLS does the gating). Filter chips for category,
// country, and minimum rating; tap a card to open ProviderDetailScreen.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import {
  Provider,
  ProviderCategory,
  ProviderFilters,
  useProviders,
} from "../hooks/useProviders";

type Nav = StackNavigationProp<RootStackParamList>;

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
  const { t } = useTranslation();

  const [category, setCategory] = useState<ProviderCategory | undefined>(undefined);
  const [country, setCountry] = useState<string | undefined>(undefined);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);

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
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("provider_list.title")}</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

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
          renderItem={({ item }) => (
            <ProviderCard
              provider={item}
              onPress={() => navigation.navigate("ProviderDetail", { providerId: item.id })}
            />
          )}
        />
      )}
    </View>
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
  onPress,
}: {
  provider: Provider;
  onPress: () => void;
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
        <View style={styles.viewBtn}>
          <Text style={styles.viewBtnText}>{t("provider_list.view")}</Text>
          <Ionicons name="chevron-forward" size={14} color="#00C6AE" />
        </View>
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
});
