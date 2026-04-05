import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useMarketInsight, type StoreCategory } from "../hooks/useMarketplace";

const CITIES = [
  { key: "atlanta", label: "Atlanta, GA" },
  { key: "houston", label: "Houston, TX" },
  { key: "dc", label: "Washington, DC" },
  { key: "newyork", label: "New York, NY" },
  { key: "chicago", label: "Chicago, IL" },
  { key: "dallas", label: "Dallas, TX" },
  { key: "miami", label: "Miami, FL" },
  { key: "charlotte", label: "Charlotte, NC" },
];

const CATEGORIES: { key: StoreCategory; icon: string; color: string; label: string }[] = [
  { key: "food", icon: "restaurant", color: "#F59E0B", label: "Food & Catering" },
  { key: "beauty", icon: "cut", color: "#EC4899", label: "Beauty & Hair" },
  { key: "travel", icon: "airplane", color: "#3B82F6", label: "Travel & Trips" },
  { key: "shipping", icon: "cube", color: "#8B5CF6", label: "Shipping & Freight" },
  { key: "finance", icon: "cash", color: "#10B981", label: "Financial Services" },
  { key: "events", icon: "calendar", color: "#F97316", label: "Events & Planning" },
  { key: "realestate", icon: "home", color: "#6366F1", label: "Real Estate" },
  { key: "health", icon: "heart", color: "#EF4444", label: "Health & Wellness" },
];

export default function MarketInsightScreen() {
  const navigation = useNavigation<any>();
  const [selectedCity, setSelectedCity] = useState("atlanta");
  const [selectedCategory, setSelectedCategory] = useState<StoreCategory>("food");
  const [customers, setCustomers] = useState(20);
  const [repeatRate, setRepeatRate] = useState(2);

  const { insight, opportunityLevel, estimateRevenue } = useMarketInsight(selectedCity, selectedCategory);

  const cityLabel = CITIES.find(c => c.key === selectedCity)?.label ?? selectedCity;
  const catConfig = CATEGORIES.find(c => c.key === selectedCategory);

  const estimate = useMemo(() => {
    if (!insight) return null;
    return estimateRevenue(customers, insight.avgOrderValueCents, repeatRate);
  }, [insight, customers, repeatRate, estimateRevenue]);

  const formatMoney = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const opportunityConfig = {
    very_high: { label: "Very High Opportunity", color: "#059669", bg: "#D1FAE5" },
    high: { label: "High Opportunity", color: "#D97706", bg: "#FEF3C7" },
    good: { label: "Good Opportunity", color: "#3B82F6", bg: "#DBEAFE" },
  };

  const opp = opportunityLevel ? opportunityConfig[opportunityLevel] : null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Market Insight</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.headerSubtitle}>See the demand for your services</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* City Selector */}
        <Text style={styles.fieldLabel}>Your City</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
          <View style={styles.pillRow}>
            {CITIES.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[styles.pill, selectedCity === c.key && styles.pillActive]}
                onPress={() => setSelectedCity(c.key)}
              >
                <Text style={[styles.pillText, selectedCity === c.key && { color: "#FFFFFF" }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Category Selector */}
        <Text style={styles.fieldLabel}>Your Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
          <View style={styles.pillRow}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[styles.pill, selectedCategory === c.key && { backgroundColor: c.color, borderColor: c.color }]}
                onPress={() => setSelectedCategory(c.key)}
              >
                <Ionicons name={c.icon as any} size={14} color={selectedCategory === c.key ? "#FFFFFF" : c.color} />
                <Text style={[styles.pillText, selectedCategory === c.key && { color: "#FFFFFF" }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {insight && (
          <>
            {/* Stats Cards */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: "#FEF3C7" }]}>
                <View style={styles.statCardHeader}>
                  <Ionicons name="people" size={18} color="#D97706" />
                  <View style={styles.hotBadge}><Text style={styles.hotBadgeText}>HOT</Text></View>
                </View>
                <Text style={styles.statCardValue}>{insight.diasporaPopulation.toLocaleString()}</Text>
                <Text style={styles.statCardLabel}>Diaspora households in {cityLabel}</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: "#D1FAE5" }]}>
                <View style={styles.statCardHeader}>
                  <Ionicons name="cash" size={18} color="#059669" />
                  <View style={[styles.hotBadge, { backgroundColor: "#059669" }]}><Text style={styles.hotBadgeText}>EST.</Text></View>
                </View>
                <Text style={styles.statCardValue}>${insight.annualSpendMillions}M</Text>
                <Text style={styles.statCardLabel}>Annual {catConfig?.label} spending</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: "#DBEAFE" }]}>
                <View style={styles.statCardHeader}>
                  <Ionicons name="phone-portrait" size={18} color="#2563EB" />
                  <View style={[styles.hotBadge, { backgroundColor: "#2563EB" }]}><Text style={styles.hotBadgeText}>LIVE</Text></View>
                </View>
                <Text style={styles.statCardValue}>{insight.activeMembers.toLocaleString()}</Text>
                <Text style={styles.statCardLabel}>TandaXn members active</Text>
              </View>
            </View>

            {/* Demand vs Supply */}
            <View style={styles.gapCard}>
              <Text style={styles.gapTitle}>Demand vs Supply Gap</Text>

              <View style={styles.gapBarRow}>
                <Text style={styles.gapBarLabel}>Customer Demand</Text>
                <View style={styles.gapBarBg}>
                  <View style={[styles.gapBarFill, { width: "85%", backgroundColor: "#00C6AE" }]} />
                </View>
                <Text style={styles.gapBarPct}>85%</Text>
              </View>

              <View style={styles.gapBarRow}>
                <Text style={styles.gapBarLabel}>Providers Listed</Text>
                <View style={styles.gapBarBg}>
                  <View style={[styles.gapBarFill, { width: `${insight.supplyPct}%`, backgroundColor: "#EF4444" }]} />
                </View>
                <Text style={styles.gapBarPct}>{insight.supplyPct}%</Text>
              </View>

              <View style={styles.gapCallout}>
                <Ionicons name="alert-circle" size={16} color={opp?.color ?? "#059669"} />
                <Text style={[styles.gapCalloutText, { color: opp?.color }]}>
                  Only {insight.providerCount} providers in {catConfig?.label} — {opp?.label}
                </Text>
              </View>
            </View>

            {/* Revenue Estimator */}
            <View style={styles.revenueCard}>
              <Text style={styles.revenueTitle}>Revenue Estimator</Text>

              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Customers/month</Text>
                <View style={styles.sliderBtns}>
                  <TouchableOpacity style={styles.sliderBtn} onPress={() => setCustomers(Math.max(5, customers - 5))}>
                    <Ionicons name="remove" size={16} color="#0A2342" />
                  </TouchableOpacity>
                  <Text style={styles.sliderValue}>{customers}</Text>
                  <TouchableOpacity style={styles.sliderBtn} onPress={() => setCustomers(Math.min(100, customers + 5))}>
                    <Ionicons name="add" size={16} color="#0A2342" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sliderRow}>
                <Text style={styles.sliderLabel}>Repeat visits</Text>
                <View style={styles.sliderBtns}>
                  <TouchableOpacity style={styles.sliderBtn} onPress={() => setRepeatRate(Math.max(1, repeatRate - 0.5))}>
                    <Ionicons name="remove" size={16} color="#0A2342" />
                  </TouchableOpacity>
                  <Text style={styles.sliderValue}>{repeatRate}x</Text>
                  <TouchableOpacity style={styles.sliderBtn} onPress={() => setRepeatRate(Math.min(6, repeatRate + 0.5))}>
                    <Ionicons name="add" size={16} color="#0A2342" />
                  </TouchableOpacity>
                </View>
              </View>

              {estimate && (
                <View style={styles.revenueResult}>
                  <View style={styles.revenueResultItem}>
                    <Text style={styles.revenueResultLabel}>Monthly Revenue</Text>
                    <Text style={styles.revenueResultValue}>{formatMoney(estimate.monthlyRevenueCents)}</Text>
                  </View>
                  <View style={styles.revenueResultItem}>
                    <Text style={styles.revenueResultLabel}>Annual Revenue</Text>
                    <Text style={[styles.revenueResultValue, { color: "#00C6AE" }]}>{formatMoney(estimate.annualRevenueCents)}</Text>
                  </View>
                  <View style={styles.revenueResultItem}>
                    <Text style={styles.revenueResultLabel}>Monthly Orders</Text>
                    <Text style={styles.revenueResultValue}>{estimate.monthlyOrders}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Community Breakdown */}
            {insight.communityBreakdown?.length > 0 && (
              <View style={styles.communityCard}>
                <Text style={styles.communityTitle}>Community Breakdown</Text>
                {insight.communityBreakdown.map((c: any, i: number) => (
                  <View key={i} style={styles.communityRow}>
                    <Text style={styles.communityName}>{c.name}</Text>
                    <View style={styles.communityBarBg}>
                      <View
                        style={[styles.communityBarFill, {
                          width: `${(c.pop / insight.diasporaPopulation) * 100}%`,
                        }]}
                      />
                    </View>
                    <Text style={styles.communityPop}>~{c.pop.toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => navigation.navigate("StoreApplication")}
        >
          <Ionicons name="storefront" size={20} color="#FFFFFF" />
          <Text style={styles.ctaBtnText}>Create My Free Page Now</Text>
        </TouchableOpacity>

        <View style={styles.trustRow}>
          {["Free to list", "No credit card", "Claim anytime", "Community-verified"].map(t => (
            <View key={t} style={styles.trustItem}>
              <Ionicons name="checkmark-circle" size={12} color="#10B981" />
              <Text style={styles.trustText}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.7)", textAlign: "center" },
  content: { flex: 1, padding: 20 },

  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#0A2342", marginBottom: 10, marginTop: 16 },

  pillScroll: { marginBottom: 4 },
  pillRow: { flexDirection: "row", gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB" },
  pillActive: { backgroundColor: "#0A2342", borderColor: "#0A2342" },
  pillText: { fontSize: 13, fontWeight: "600", color: "#0A2342" },

  statsGrid: { flexDirection: "row", gap: 8, marginTop: 20 },
  statCard: { flex: 1, borderRadius: 14, padding: 14 },
  statCardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  hotBadge: { backgroundColor: "#D97706", paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  hotBadgeText: { fontSize: 9, fontWeight: "700", color: "#FFFFFF" },
  statCardValue: { fontSize: 20, fontWeight: "700", color: "#0A2342" },
  statCardLabel: { fontSize: 11, color: "#6B7280", marginTop: 4 },

  gapCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  gapTitle: { fontSize: 15, fontWeight: "600", color: "#0A2342", marginBottom: 16 },
  gapBarRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  gapBarLabel: { width: 110, fontSize: 12, color: "#6B7280" },
  gapBarBg: { flex: 1, height: 10, backgroundColor: "#F3F4F6", borderRadius: 5, marginHorizontal: 8 },
  gapBarFill: { height: 10, borderRadius: 5 },
  gapBarPct: { width: 36, fontSize: 12, fontWeight: "600", color: "#0A2342", textAlign: "right" },
  gapCallout: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12 },
  gapCalloutText: { flex: 1, fontSize: 13, fontWeight: "600" },

  revenueCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  revenueTitle: { fontSize: 15, fontWeight: "600", color: "#0A2342", marginBottom: 16 },
  sliderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sliderLabel: { fontSize: 14, color: "#6B7280" },
  sliderBtns: { flexDirection: "row", alignItems: "center", gap: 12 },
  sliderBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  sliderValue: { fontSize: 16, fontWeight: "700", color: "#0A2342", width: 40, textAlign: "center" },
  revenueResult: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 16 },
  revenueResultItem: { flex: 1, alignItems: "center" },
  revenueResultLabel: { fontSize: 11, color: "#9CA3AF", marginBottom: 4 },
  revenueResultValue: { fontSize: 18, fontWeight: "700", color: "#0A2342" },

  communityCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  communityTitle: { fontSize: 15, fontWeight: "600", color: "#0A2342", marginBottom: 16 },
  communityRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  communityName: { width: 100, fontSize: 13, color: "#0A2342" },
  communityBarBg: { flex: 1, height: 8, backgroundColor: "#F3F4F6", borderRadius: 4, marginHorizontal: 8 },
  communityBarFill: { height: 8, backgroundColor: "#00C6AE", borderRadius: 4 },
  communityPop: { width: 60, fontSize: 12, color: "#6B7280", textAlign: "right" },

  ctaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#00C6AE", borderRadius: 14, paddingVertical: 18, marginTop: 24 },
  ctaBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },

  trustRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 16 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  trustText: { fontSize: 12, color: "#6B7280" },
});
