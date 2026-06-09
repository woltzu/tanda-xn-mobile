// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalBItemsScreen.tsx — GOALS-013
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 164-GOALS-013-GoalBItems.jsx.
//
// "What you'll need" marketplace: partner services tied to a goal (e.g.
// home inspection, mortgage broker) with TandaXn member discounts.
// Filter by All / Required / Recommended / Saved; each card has a partner
// row (logo initial + VERIFIED), a Get This Deal CTA, and a save toggle.
//
// NAVIGATION — translation-only batch. onBack → goBack(); "Get This Deal"
// is a "coming soon" Alert placeholder tagged TODO(goals-wiring). Save is a
// local heart toggle (no nav), seeded from each item's isSaved flag.
//
// Route params (all optional — defaults applied for standalone preview).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const GREEN = "#059669";
const AMBER = "#D97706";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type BItemsGoal = {
  id: string;
  name: string;
  emoji: string;
  type: string;
};

type BItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedCost: string;
  tandaDiscount: string;
  partner: string;
  partnerLogo: string | null;
  isRequired: boolean;
  isSaved: boolean;
};

type GoalBItemsParams = {
  goal?: BItemsGoal;
  bItems?: BItem[];
};
type GoalBItemsRouteProp = RouteProp<{ GoalBItems: GoalBItemsParams }, "GoalBItems">;

const DEFAULT_GOAL: BItemsGoal = {
  id: "g1",
  name: "First Home in Atlanta",
  emoji: "🏠",
  type: "first_home",
};

const DEFAULT_BITEMS: BItem[] = [
  { id: "b1", name: "Home Inspection", description: "Professional inspection before purchase", category: "Required", estimatedCost: "$300 - $500", tandaDiscount: "15% off", partner: "HomeCheck Pro", partnerLogo: null, isRequired: true, isSaved: false },
  { id: "b2", name: "Mortgage Broker", description: "Find the best loan rates", category: "Required", estimatedCost: "Free (paid by lender)", tandaDiscount: "$500 closing credit", partner: "RateMatch", partnerLogo: null, isRequired: true, isSaved: true },
  { id: "b3", name: "Home Insurance", description: "Required by most lenders", category: "Required", estimatedCost: "$1,200/year", tandaDiscount: "10% off first year", partner: "SafeHome Insurance", partnerLogo: null, isRequired: true, isSaved: false },
  { id: "b4", name: "Title Company", description: "Title search and insurance", category: "Required", estimatedCost: "$1,000 - $2,000", tandaDiscount: "10% off", partner: "ClearTitle LLC", partnerLogo: null, isRequired: true, isSaved: false },
  { id: "b5", name: "Moving Services", description: "Professional movers", category: "Recommended", estimatedCost: "$500 - $2,000", tandaDiscount: "15% off", partner: "SwiftMove", partnerLogo: null, isRequired: false, isSaved: false },
  { id: "b6", name: "Real Estate Attorney", description: "Legal review of documents", category: "Recommended", estimatedCost: "$500 - $1,500", tandaDiscount: "First consultation free", partner: "HomeLegal Partners", partnerLogo: null, isRequired: false, isSaved: false },
];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "required", label: "Required" },
  { key: "recommended", label: "Recommended" },
  { key: "saved", label: "Saved" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const TOTAL_ESTIMATED_COST = "$3,500 - $7,500";
const TOTAL_DISCOUNT = "Up to $800";

export default function GoalBItemsScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<GoalBItemsRouteProp>();

  const goal = route.params?.goal ?? DEFAULT_GOAL;
  const bItems = route.params?.bItems ?? DEFAULT_BITEMS;

  const [filter, setFilter] = useState<FilterKey>("all");
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(bItems.filter((b) => b.isSaved).map((b) => b.id))
  );

  const toggleSave = (id: string) =>
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filteredItems = bItems.filter((item) => {
    if (filter === "required") return item.isRequired;
    if (filter === "recommended") return !item.isRequired;
    if (filter === "saved") return savedIds.has(item.id);
    return true;
  });

  // TODO(goals-wiring): "Get This Deal" → partner deep link / GoalBItem detail.
  const comingSoon = (label: string) =>
    Alert.alert(label, "This will be available soon.");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HEADER ===== */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerKicker} numberOfLines={1}>
                {goal.emoji} {goal.name}
              </Text>
              <Text style={styles.headerTitle}>{t("screen_headers.goal_b_items")}</Text>
            </View>
          </View>

          {/* Summary */}
          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>{t("final_polish.goalbitems_est_additional_costs")}</Text>
              <Text style={styles.summaryValue}>{TOTAL_ESTIMATED_COST}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.summaryLabel}>{t("final_polish.goalbitems_tanda_savings")}</Text>
              <Text style={[styles.summaryValue, { color: TEAL }]}>
                {TOTAL_DISCOUNT}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ===== CONTENT ===== */}
        <View style={styles.contentWrap}>
          {/* Filter tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map((tab) => {
              const isActive = filter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setFilter(tab.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      isActive && styles.filterTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* B-items list */}
          <View style={{ gap: 12 }}>
            {filteredItems.map((item) => {
              const isSaved = savedIds.has(item.id);
              return (
                <View key={item.id} style={styles.card}>
                  {/* Header */}
                  <View style={styles.itemHeader}>
                    <View style={styles.itemHeaderLeft}>
                      <View
                        style={[
                          styles.itemIconBox,
                          { backgroundColor: item.isRequired ? "#FEF3C7" : "#F0FDFB" },
                        ]}
                      >
                        <Text style={styles.itemIconEmoji}>
                          {item.isRequired ? "⚠️" : "💡"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemDesc}>{item.description}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: item.isRequired ? "#FEF3C7" : "#F0FDFB" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryBadgeText,
                          { color: item.isRequired ? AMBER : GREEN },
                        ]}
                      >
                        {item.category}
                      </Text>
                    </View>
                  </View>

                  {/* Cost & discount */}
                  <View style={styles.costRow}>
                    <View>
                      <Text style={styles.costLabel}>{t("final_polish.goalbitems_estimated_cost")}</Text>
                      <Text style={styles.costValue}>{item.estimatedCost}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.costLabel}>{t("final_polish.goalbitems_tanda_discount")}</Text>
                      <Text style={[styles.costValue, { color: GREEN }]}>
                        {item.tandaDiscount}
                      </Text>
                    </View>
                  </View>

                  {/* Partner */}
                  <View style={styles.partnerRow}>
                    <View style={styles.partnerLeft}>
                      <View style={styles.partnerLogo}>
                        <Text style={styles.partnerLogoText}>
                          {item.partner.charAt(0)}
                        </Text>
                      </View>
                      <Text style={styles.partnerName}>
                        Partner: {item.partner}
                      </Text>
                    </View>
                    <View style={styles.verifiedTag}>
                      <Text style={styles.verifiedText}>{t("final_polish.goalbitems_verified")}</Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => comingSoon(`Get This Deal — ${item.name}`)}
                      accessibilityRole="button"
                      style={styles.dealButton}
                    >
                      <Text style={styles.dealButtonText}>{t("final_polish.goalbitems_get_this_deal")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => toggleSave(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={isSaved ? "Unsave" : "Save"}
                      accessibilityState={{ selected: isSaved }}
                      style={[
                        styles.saveButton,
                        isSaved && { backgroundColor: "#F0FDFB" },
                      ]}
                    >
                      <Text style={styles.saveIcon}>{isSaved ? "❤️" : "♡"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Info card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoEmoji}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>{t("final_polish.goalbitems_why_partner_discounts")}</Text>
              <Text style={styles.infoBody}>
                TandaXn negotiates exclusive rates with vetted providers. When
                you achieve your goal with us, you deserve to save on the next
                steps too.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: { paddingTop: 20, paddingBottom: 60, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerKicker: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },

  summaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
  },
  summaryLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)" },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },

  contentWrap: { marginTop: -30, paddingHorizontal: 16 },

  filterRow: { gap: 8, paddingVertical: 4, marginBottom: 12 },
  filterPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  filterPillActive: { backgroundColor: NAVY },
  filterText: { fontSize: 12, fontWeight: "600", color: MUTED },
  filterTextActive: { color: "#FFFFFF" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  itemHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  itemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  itemIconEmoji: { fontSize: 18 },
  itemName: { fontSize: 15, fontWeight: "600", color: NAVY },
  itemDesc: { fontSize: 11, color: MUTED, marginTop: 2 },
  categoryBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  categoryBadgeText: { fontSize: 10, fontWeight: "600" },

  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    marginBottom: 12,
  },
  costLabel: { fontSize: 10, color: "#9CA3AF" },
  costValue: { fontSize: 14, fontWeight: "600", color: NAVY, marginTop: 2 },

  partnerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    marginBottom: 12,
  },
  partnerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  partnerLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center",
  },
  partnerLogoText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  partnerName: { fontSize: 12, fontWeight: "500", color: "#1D4ED8", flex: 1 },
  verifiedTag: {
    backgroundColor: "#DBEAFE",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  verifiedText: { fontSize: 10, fontWeight: "600", color: "#1D4ED8" },

  actionRow: { flexDirection: "row", gap: 10 },
  dealButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  dealButtonText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  saveButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  saveIcon: { fontSize: 18, color: MUTED },

  infoCard: {
    marginTop: 20,
    padding: 16,
    backgroundColor: NAVY,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoEmoji: { fontSize: 24 },
  infoTitle: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  infoBody: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 18,
    marginTop: 6,
  },
});
