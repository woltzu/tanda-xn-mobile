// =============================================================================
// FAQScreen -- searchable, category-filterable FAQ backed by config/faq.ts.
//
// Three controls:
//   * Free-text search across question + answer
//   * Category chip strip (All + 7 categories)
//   * Accordion-style expansion per row (tap to open, tap again to close)
//
// Contact Support button at the bottom opens mailto: -- when we ship a
// real chat (Intercom / Crisp / etc.), swap the Linking call for a
// navigation push into the chat screen.
//
// FUTURE / OUT OF SCOPE:
// In-app errors (KYC failure, advance denial, contribution problems)
// should grow a "Help" button that navigates HERE with a deep link
// like `navigation.navigate('FAQ', { category: 'verification' })` or
// `{ initialQuery: 'kyc' }`. The screen already accepts both via route
// params; the trigger sites are the follow-up work.
// =============================================================================

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import {
  FAQ_ITEMS,
  FAQ_CATEGORIES,
  type FAQCategory,
  type FAQItem,
} from "../config/faq";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const BG = "#F3F4F6";
const MUTED = "#6B7280";

const SUPPORT_EMAIL = "support@tandaxn.com";

type FAQRouteParams = {
  category?: FAQCategory;
  initialQuery?: string;
};

type FAQRouteProp = RouteProp<{ FAQ: FAQRouteParams }, "FAQ">;

export default function FAQScreen() {
  const navigation = useNavigation();
  const route = useRoute<FAQRouteProp>();

  // Deep-link support: callers can preselect a category and/or seed the
  // search box. See header note about in-app error -> Help integration.
  const [query, setQuery] = useState(route.params?.initialQuery ?? "");
  const [category, setCategory] = useState<FAQCategory | "all">(
    route.params?.category ?? "all",
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ_ITEMS.filter((row) => {
      if (category !== "all" && row.category !== category) return false;
      if (!q) return true;
      return (
        row.question.toLowerCase().includes(q) ||
        row.answer.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  const findById = (id: string): FAQItem | undefined =>
    FAQ_ITEMS.find((r) => r.id === id);

  const handleContactSupport = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      "TandaXn support request",
    )}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert(
        "Email unavailable",
        `Reach us at ${SUPPORT_EMAIL} when you're back online.`,
      );
      return;
    }
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & FAQ</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={MUTED} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search FAQ..."
            placeholderTextColor={MUTED}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search FAQ"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={MUTED} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label="All"
            active={category === "all"}
            onPress={() => setCategory("all")}
          />
          {FAQ_CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              icon={c.icon as keyof typeof Ionicons.glyphMap}
              active={category === c.id}
              onPress={() => setCategory(c.id)}
            />
          ))}
        </ScrollView>

        {/* Result count */}
        <Text style={styles.resultCount}>
          {filtered.length} of {FAQ_ITEMS.length} articles
        </Text>

        {/* List */}
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="search-outline" size={32} color={MUTED} />
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptyBody}>
              Try a different search term, or clear the filters to see
              every article.
            </Text>
          </View>
        ) : (
          filtered.map((row) => {
            const open = expanded === row.id;
            const cat = FAQ_CATEGORIES.find((c) => c.id === row.category);
            return (
              <View key={row.id} style={styles.card}>
                <TouchableOpacity
                  style={styles.cardHead}
                  onPress={() => setExpanded(open ? null : row.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                >
                  <View style={styles.cardHeadText}>
                    {cat ? (
                      <Text style={styles.cardCat}>
                        {cat.label.toUpperCase()}
                      </Text>
                    ) : null}
                    <Text style={styles.cardQ}>{row.question}</Text>
                  </View>
                  <Ionicons
                    name={open ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={MUTED}
                  />
                </TouchableOpacity>

                {open ? (
                  <View style={styles.cardBody}>
                    <Text style={styles.cardA}>{row.answer}</Text>

                    {row.related && row.related.length > 0 ? (
                      <View style={styles.relatedWrap}>
                        <Text style={styles.relatedLabel}>Related</Text>
                        {row.related.map((rid) => {
                          const related = findById(rid);
                          if (!related) return null;
                          return (
                            <TouchableOpacity
                              key={rid}
                              style={styles.relatedRow}
                              onPress={() => {
                                setExpanded(rid);
                                setCategory(related.category);
                              }}
                              accessibilityRole="link"
                              accessibilityLabel={`Open ${related.question}`}
                            >
                              <Ionicons
                                name="arrow-forward-circle-outline"
                                size={14}
                                color={TEAL}
                              />
                              <Text style={styles.relatedText} numberOfLines={2}>
                                {related.question}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        {/* Contact Support */}
        <View style={styles.contactCard}>
          <Ionicons name="chatbubbles-outline" size={22} color={NAVY} />
          <Text style={styles.contactTitle}>Still stuck?</Text>
          <Text style={styles.contactBody}>
            Send us a note and a human will get back to you within one
            business day.
          </Text>
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={handleContactSupport}
            accessibilityRole="button"
            accessibilityLabel="Email TandaXn support"
          >
            <Ionicons name="mail-outline" size={14} color="#FFFFFF" />
            <Text style={styles.contactBtnText}>Contact support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={13}
          color={active ? "#FFFFFF" : NAVY}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text
        style={[
          styles.chipText,
          active && { color: "#FFFFFF" },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    backgroundColor: NAVY,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { padding: 8, minWidth: 40, minHeight: 40 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  scroll: { flex: 1 },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: NAVY, paddingVertical: 0 },

  chipRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipActive: { backgroundColor: NAVY, borderColor: NAVY },
  chipText: { fontSize: 12, fontWeight: "600", color: NAVY },

  resultCount: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  cardHead: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardHeadText: { flex: 1 },
  cardCat: {
    fontSize: 10,
    color: TEAL,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  cardQ: { fontSize: 14, fontWeight: "700", color: NAVY, lineHeight: 19 },
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 12,
  },
  cardA: { fontSize: 13, color: NAVY, lineHeight: 20 },

  relatedWrap: { marginTop: 12 },
  relatedLabel: {
    fontSize: 10,
    color: MUTED,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  relatedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  relatedText: { flex: 1, fontSize: 12, color: NAVY },

  contactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 16,
    alignItems: "center",
    gap: 6,
  },
  contactTitle: { fontSize: 15, fontWeight: "700", color: NAVY, marginTop: 4 },
  contactBody: {
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 8,
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  contactBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  emptyBox: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 32,
    gap: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: NAVY, marginTop: 4 },
  emptyBody: { fontSize: 12, color: MUTED, textAlign: "center", lineHeight: 18 },
});
