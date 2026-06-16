// ══════════════════════════════════════════════════════════════════════════════
// screens/CircleAutopayManagementScreen.tsx
//
// Phase 0 of Circle Contribution Autopay. List all of the user's
// autopay configs (one per circle) with:
//   - circle name + amount + next execution date
//   - status badge (active / paused — disabled rows hidden by the hook)
//   - edit  → CircleAutopaySetup { circleId }
//   - delete → soft delete via the hook's remove()
//
// Empty state routes to CircleAutopaySetup with no circleId so the
// user picks a circle inline.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import {
  useCircleAutopayList,
  useCircleAutopayConfig,
  CircleAutopayListItem,
} from "../hooks/useCircleAutopay";
import { showToast } from "../components/Toast";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const AMBER = "#F59E0B";

function formatNext(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// Phase 1: returns true when the next run is within 3 days from now.
// Drives the amber warning icon next to the "Next run:" line.
function isDueSoon(iso: string | null): boolean {
  if (!iso) return false;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return false;
  return ms >= 0 && ms <= 3 * 86_400_000;
}

export default function CircleAutopayManagementScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const { items, loading, refetch } = useCircleAutopayList();

  // Refresh on every focus so a save() on the setup screen surfaces
  // here without the user pulling down.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <LinearGradient
        colors={[NAVY, "#143654"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t("circle_autopay_management.a11y_back")}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {t("circle_autopay_management.header_title")}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t("circle_autopay_management.header_subtitle")}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate("CircleAutopaySetup")}
            accessibilityRole="button"
            accessibilityLabel={t("circle_autopay_management.a11y_add")}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="repeat" size={48} color={MUTED} />
          <Text style={styles.emptyTitle}>
            {t("circle_autopay_management.empty_title")}
          </Text>
          <Text style={styles.emptyBody}>
            {t("circle_autopay_management.empty_body")}
          </Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={() => navigation.navigate("CircleAutopaySetup")}
          >
            <Text style={styles.emptyCtaText}>
              {t("circle_autopay_management.empty_cta")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {items.map((item) => (
            <ConfigRow key={item.id} item={item} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ConfigRow({ item }: { item: CircleAutopayListItem }) {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  // Hook reuse: gives us remove() scoped to the same circle. We don't
  // need its `config` field (we already have the data from the list
  // hook), so the local result is just for the side-effect method.
  const { remove } = useCircleAutopayConfig(item.circle_id);
  const [removing, setRemoving] = useState(false);

  const status = item.status;
  const isPaused = status === "paused";

  const onDelete = () => {
    Alert.alert(
      t("circle_autopay_management.delete_title"),
      t("circle_autopay_management.delete_body", {
        name: item.circle.name,
      }),
      [
        { text: t("circle_autopay_management.cancel"), style: "cancel" },
        {
          text: t("circle_autopay_management.delete"),
          style: "destructive",
          onPress: async () => {
            setRemoving(true);
            try {
              await remove();
              showToast(
                t("circle_autopay_management.toast_removed"),
                "success",
              );
            } catch (err: any) {
              showToast(
                err?.message ||
                  t("circle_autopay_management.toast_remove_failed"),
                "error",
              );
            } finally {
              setRemoving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="people-circle" size={26} color={TEAL} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.circle.name}
          </Text>
          <Text style={styles.cardSub}>
            {t("circle_autopay_management.amount_line", {
              amount: (item.contribution_amount_cents / 100).toFixed(2),
            })}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            isPaused ? styles.statusPillPaused : styles.statusPillActive,
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              isPaused
                ? styles.statusPillTextPaused
                : styles.statusPillTextActive,
            ]}
          >
            {isPaused
              ? t("circle_autopay_management.status_paused")
              : t("circle_autopay_management.status_active")}
          </Text>
        </View>
      </View>

      <View style={styles.nextRow}>
        {isDueSoon(item.next_execution_at) && (
          <Ionicons name="alert-circle" size={14} color={AMBER} />
        )}
        <Text style={styles.cardNext}>
          {t("circle_autopay_management.next_run", {
            date: formatNext(item.next_execution_at),
          })}
        </Text>
      </View>

      {/* Phase 1 — explainer under the PAUSED pill. The cron sets
          status='paused' after 3 failures in a 7-day window. */}
      {isPaused && (
        <Text style={styles.pausedHelper}>
          {t("circle_autopay_management.paused_helper")}
        </Text>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            navigation.navigate("CircleAutopaySetup", {
              circleId: item.circle_id,
              configId: item.id,
            })
          }
        >
          <Ionicons name="create-outline" size={16} color={NAVY} />
          <Text style={styles.actionButtonText}>
            {t("circle_autopay_management.edit")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDanger]}
          onPress={onDelete}
          disabled={removing}
        >
          {removing ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text
                style={[styles.actionButtonText, styles.actionButtonTextDanger]}
              >
                {t("circle_autopay_management.delete")}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
    marginTop: 10,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyCta: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: TEAL,
    borderRadius: 12,
  },
  emptyCtaText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

  listContent: { padding: 20, gap: 12 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: NAVY },
  cardSub: { fontSize: 12, color: MUTED, marginTop: 2 },

  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillActive: { backgroundColor: "#ECFDF5" },
  statusPillPaused: { backgroundColor: "#FEF3C7" },
  statusPillText: { fontSize: 10, fontWeight: "800" },
  statusPillTextActive: { color: "#047857" },
  statusPillTextPaused: { color: "#92400E" },

  cardNext: { flex: 1, fontSize: 12, color: MUTED },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  pausedHelper: {
    fontSize: 11,
    color: "#92400E",
    marginTop: 6,
    fontStyle: "italic",
  },

  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F5F7FA",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F5F7FA",
  },
  actionButtonDanger: { backgroundColor: "#FEE2E2" },
  actionButtonText: { fontSize: 12, fontWeight: "700", color: NAVY },
  actionButtonTextDanger: { color: "#EF4444" },
});
