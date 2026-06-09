// ══════════════════════════════════════════════════════════════════════════════
// screens/ManageServicesScreen.tsx — Store owner manages their service list
// ══════════════════════════════════════════════════════════════════════════════
//
// Route param: { storeId: string }
//
// Fetches services via MarketplaceEngine.getStoreServices(storeId) — called
// directly rather than through useOwnerDashboard because the dashboard hook
// also pulls bookings/reviews/inquiries which we'd waste on every list
// refresh after an add/edit/delete.
//
// Refresh strategy: useFocusEffect re-fetches whenever this screen comes
// back into focus. ServiceFormScreen pops back to here on save, which
// re-triggers the focus effect — no callback param plumbing needed.
//
// Delete is a destructive op so it's gated behind a confirmation Alert.
//
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useMarketplaceActions } from "../hooks/useMarketplace";
import { MarketplaceEngine, type StoreService } from "../services/MarketplaceEngine";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type ManageServicesRouteParams = { storeId: string };
type ManageServicesRouteProp = RouteProp<
  { ManageServices: ManageServicesRouteParams },
  "ManageServices"
>;

export default function ManageServicesScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<ManageServicesRouteProp>();
  const storeId = route.params?.storeId ?? "";

  const { deleteService } = useMarketplaceActions();

  const [services, setServices] = useState<StoreService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(
    async (isRefresh = false) => {
      if (!storeId) {
        setError("Missing store ID");
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await MarketplaceEngine.getStoreServices(storeId);
        setServices(data);
      } catch (err: any) {
        console.error("[ManageServices] fetch failed:", err);
        setError(err?.message ?? "Could not load services");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [storeId],
  );

  // Re-fetch on every focus — covers the post-ServiceForm-goBack case
  // without explicit callback plumbing.
  useFocusEffect(
    useCallback(() => {
      fetchServices(false);
    }, [fetchServices]),
  );

  const handleAdd = () => {
    navigation.navigate(Routes.ServiceForm, { storeId });
  };

  const handleEdit = (service: StoreService) => {
    navigation.navigate(Routes.ServiceForm, { storeId, service });
  };

  const handleDelete = (service: StoreService) => {
    Alert.alert(
      "Delete service?",
      `"${service.name}" will be removed from your storefront. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteService(service.id);
              // Optimistic: drop the row from local state immediately so
              // the user sees a snappy response. useFocusEffect will
              // reconcile on next focus, so any drift self-corrects.
              setServices((prev) => prev.filter((s) => s.id !== service.id));
            } catch (err: any) {
              console.error("[ManageServices] delete failed:", err);
              Alert.alert(
                "Could not delete",
                err?.message ?? "Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDuration = (mins: number | null) => {
    if (!mins) return null;
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem === 0 ? `${hours} hr` : `${hours} hr ${rem} min`;
  };

  const renderItem = ({ item }: { item: StoreService }) => {
    const duration = formatDuration(item.durationMinutes);
    return (
      <View style={styles.serviceCard}>
        <View style={styles.serviceMain}>
          <View style={styles.serviceHeader}>
            <Text style={styles.serviceEmoji}>{item.emoji || "🛍️"}</Text>
            <View style={styles.serviceTitleBlock}>
              <Text style={styles.serviceName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.serviceMetaRow}>
                <Text style={styles.servicePrice}>{formatPrice(item.priceCents)}</Text>
                {duration && (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.serviceMeta}>{duration}</Text>
                  </>
                )}
                {item.isPopular && (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={[styles.serviceMeta, { color: TEAL }]}>Popular</Text>
                  </>
                )}
              </View>
            </View>
          </View>
          {item.description ? (
            <Text style={styles.serviceDescription} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.serviceActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => handleEdit(item)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
          >
            <Ionicons name="create-outline" size={20} color={NAVY} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => handleDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
          >
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("manage_services.header_title")}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAdd}
          accessibilityRole="button"
          accessibilityLabel="Add service"
        >
          <Ionicons name="add" size={24} color={TEAL} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingText}>Loading services…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={MUTED} />
          <Text style={styles.errorTitle}>Could not load</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchServices(false)}
          >
            <Text style={styles.retryButtonText}>{t("final_polish.manageservices_retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : services.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cube-outline" size={48} color={MUTED} />
          <Text style={styles.emptyTitle}>No services yet</Text>
          <Text style={styles.emptyBody}>
            Add your first service so customers can book or buy.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleAdd}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Add Service</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchServices(true)}
              tintColor={TEAL}
            />
          }
          ListFooterComponent={() => (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {services.length} {services.length === 1 ? "service" : "services"}
              </Text>
            </View>
          )}
        />
      )}
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
  addButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: NAVY,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  separator: { height: 10 },
  serviceCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  serviceMain: { flex: 1 },
  serviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  serviceEmoji: { fontSize: 22 },
  serviceTitleBlock: { flex: 1 },
  serviceName: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 2,
  },
  serviceMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  servicePrice: {
    fontSize: 13,
    fontWeight: "600",
    color: TEAL,
  },
  serviceMeta: {
    fontSize: 12,
    color: MUTED,
  },
  metaDot: {
    fontSize: 12,
    color: MUTED,
    marginHorizontal: 6,
  },
  serviceDescription: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },
  serviceActions: {
    flexDirection: "column",
    justifyContent: "center",
    gap: 8,
    paddingLeft: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: { fontSize: 14, color: MUTED, marginTop: 8 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: NAVY,
    marginTop: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    marginBottom: 4,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: NAVY,
    marginTop: 8,
  },
  errorBody: { fontSize: 14, color: MUTED, textAlign: "center" },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: TEAL,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    marginTop: 8,
  },
  retryButtonText: { fontSize: 14, color: NAVY, fontWeight: "600" },
  footer: { paddingVertical: 16, alignItems: "center" },
  footerText: { fontSize: 12, color: MUTED },
});
