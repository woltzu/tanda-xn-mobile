// ══════════════════════════════════════════════════════════════════════════════
// screens/CommunityPreferencesScreen.tsx
//
// P2 of the Language switcher review — split. Three sections that
// used to live on LanguageRegionScreen:
//
//   1. My Communities chips (selected origin countries + communities)
//   2. Where I'm from → ORIGIN_REGIONS multi-select (2-modal flow)
//   3. Join Communities → COMMUNITY_CATEGORIES multi-select
//
// LanguageRegionScreen is now language-only; this screen owns
// everything else that used to share that page. Profile menu has a
// dedicated "Communities" row pointing here.
//
// NOTE: a separate `screens/MyCommunitiesScreen.tsx` exists for the
// AI inference rollout (read-only directory of community
// memberships). Different feature — this screen is the
// origin/interest preference picker. They co-exist intentionally.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  usePreferences,
  ORIGIN_REGIONS,
  COMMUNITY_CATEGORIES,
  Community,
} from "../context/PreferencesContext";

export default function CommunityPreferencesScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const {
    preferences,
    addOriginCountry,
    removeOriginCountry,
    toggleCommunity,
    isCommunitySelected,
    isOriginSelected,
  } = usePreferences();

  const [showOriginModal, setShowOriginModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<
    (typeof ORIGIN_REGIONS)[0] | null
  >(null);
  const [selectedCategory, setSelectedCategory] = useState<
    (typeof COMMUNITY_CATEGORIES)[0] | null
  >(null);

  const handleRegionSelect = (region: (typeof ORIGIN_REGIONS)[0]) => {
    setSelectedRegion(region);
    setShowOriginModal(false);
    setShowCountryModal(true);
  };

  const handleCountryToggle = async (
    country: (typeof ORIGIN_REGIONS)[0]["countries"][0],
  ) => {
    if (!selectedRegion) return;
    if (isOriginSelected(country.code)) {
      await removeOriginCountry(country.code);
    } else {
      await addOriginCountry({
        code: country.code,
        name: country.name,
        emoji: country.emoji,
        regionId: selectedRegion.id,
        regionName: selectedRegion.name,
      });
    }
  };

  const handleCategorySelect = (
    category: (typeof COMMUNITY_CATEGORIES)[0],
  ) => {
    setSelectedCategory(category);
    setShowCommunityModal(true);
  };

  const handleCommunityToggle = async (community: Community) => {
    await toggleCommunity(community);
  };

  const totalSelections =
    preferences.originCountries.length + preferences.communities.length;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t("community_preferences.header")}
          </Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Selected chips summary */}
        {totalSelections > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("language_region.my_communities")}
              </Text>
              <Text style={styles.selectionCount}>
                {t("language_region.selected_count", { count: totalSelections })}
              </Text>
            </View>
            <View style={styles.selectedChips}>
              {preferences.originCountries.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  style={styles.chip}
                  onPress={() => removeOriginCountry(country.code)}
                >
                  <Text style={styles.chipEmoji}>{country.emoji}</Text>
                  <Text style={styles.chipText}>{country.name}</Text>
                  <Ionicons name="close-circle" size={16} color="#6B7280" />
                </TouchableOpacity>
              ))}
              {preferences.communities.map((community) => (
                <TouchableOpacity
                  key={community.id}
                  style={styles.chip}
                  onPress={() => toggleCommunity(community)}
                >
                  <Text style={styles.chipEmoji}>{community.emoji}</Text>
                  <Text style={styles.chipText}>{community.name}</Text>
                  <Ionicons name="close-circle" size={16} color="#6B7280" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Where I'm from */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("language_region.where_im_from")}
          </Text>
          <Text style={styles.sectionDesc}>
            {t("language_region.where_im_from_desc")}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowOriginModal(true)}
          >
            <Ionicons name="earth" size={24} color="#00C6AE" />
            <Text style={styles.addButtonText}>
              {t("language_region.add_origin_country")}
            </Text>
            <Ionicons name="add-circle" size={24} color="#00C6AE" />
          </TouchableOpacity>
        </View>

        {/* Community Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("language_region.join_communities")}
          </Text>
          <Text style={styles.sectionDesc}>
            {t("language_region.join_communities_desc")}
          </Text>

          {COMMUNITY_CATEGORIES.map((category) => {
            const selectedInCategory = preferences.communities.filter(
              (c) => c.category === category.id,
            ).length;
            return (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryCard}
                onPress={() => handleCategorySelect(category)}
              >
                <View style={styles.categoryLeft}>
                  <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                  <View>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categoryDesc}>
                      {category.description}
                    </Text>
                  </View>
                </View>
                <View style={styles.categoryRight}>
                  {selectedInCategory > 0 && (
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>
                        {selectedInCategory}
                      </Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#00C6AE" />
          <Text style={styles.infoText}>
            {t("language_region.info_text")}
          </Text>
        </View>
      </ScrollView>

      {/* Region Selection Modal */}
      <Modal
        visible={showOriginModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowOriginModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t("language_region.select_region")}
              </Text>
              <TouchableOpacity onPress={() => setShowOriginModal(false)}>
                <Ionicons name="close" size={24} color="#0A2342" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={ORIGIN_REGIONS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleRegionSelect(item)}
                >
                  <Text style={styles.modalItemFlag}>{item.emoji}</Text>
                  <View style={styles.modalItemText}>
                    <Text style={styles.modalItemLabel}>{item.name}</Text>
                    <Text style={styles.modalItemSubLabel}>
                      {t("language_region.countries_count", {
                        count: item.countries.length,
                      })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* Country Selection Modal */}
      <Modal
        visible={showCountryModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowCountryModal(false);
          setSelectedRegion(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowCountryModal(false);
                  setShowOriginModal(true);
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#0A2342" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {selectedRegion?.name ||
                  t("language_region.select_countries")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCountryModal(false);
                  setSelectedRegion(null);
                }}
              >
                <Ionicons name="close" size={24} color="#0A2342" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              {t("language_region.select_all_countries_apply")}
            </Text>
            <FlatList
              data={selectedRegion?.countries || []}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    isOriginSelected(item.code) && styles.modalItemSelected,
                  ]}
                  onPress={() => handleCountryToggle(item)}
                >
                  <Text style={styles.modalItemFlag}>{item.emoji}</Text>
                  <View style={styles.modalItemText}>
                    <Text style={styles.modalItemLabel}>{item.name}</Text>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      isOriginSelected(item.code) && styles.checkboxSelected,
                    ]}
                  >
                    {isOriginSelected(item.code) && (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                setShowCountryModal(false);
                setSelectedRegion(null);
              }}
            >
              <Text style={styles.doneButtonText}>{t("common.done")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Community Selection Modal */}
      <Modal
        visible={showCommunityModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowCommunityModal(false);
          setSelectedCategory(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowCommunityModal(false);
                  setSelectedCategory(null);
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#0A2342" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {selectedCategory?.name ||
                  t("language_region.select_communities")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCommunityModal(false);
                  setSelectedCategory(null);
                }}
              >
                <Ionicons name="close" size={24} color="#0A2342" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              {t("language_region.select_all_apply")}
            </Text>
            <FlatList
              data={selectedCategory?.communities || []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    isCommunitySelected(item.id) && styles.modalItemSelected,
                  ]}
                  onPress={() => handleCommunityToggle(item)}
                >
                  <Text style={styles.modalItemFlag}>{item.emoji}</Text>
                  <View style={styles.modalItemText}>
                    <Text style={styles.modalItemLabel}>{item.name}</Text>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      isCommunitySelected(item.id) && styles.checkboxSelected,
                    ]}
                  >
                    {isCommunitySelected(item.id) && (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                setShowCommunityModal(false);
                setSelectedCategory(null);
              }}
            >
              <Text style={styles.doneButtonText}>{t("common.done")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  placeholder: { width: 40 },
  content: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 12,
    lineHeight: 20,
  },
  selectionCount: { fontSize: 13, fontWeight: "600", color: "#00C6AE" },
  selectedChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipEmoji: { fontSize: 16 },
  chipText: { fontSize: 13, fontWeight: "500", color: "#0A2342" },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: "#00C6AE",
    borderStyle: "dashed",
  },
  addButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#00C6AE",
    marginLeft: 12,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  categoryEmoji: { fontSize: 28 },
  categoryName: { fontSize: 16, fontWeight: "600", color: "#0A2342" },
  categoryDesc: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  categoryRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  categoryBadge: {
    backgroundColor: "#00C6AE",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: "center",
  },
  categoryBadgeText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#F0FDF9",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 13, color: "#0A2342", lineHeight: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0A2342" },
  modalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalItemSelected: { backgroundColor: "#F0FDF9" },
  modalItemFlag: { fontSize: 28, marginRight: 12 },
  modalItemText: { flex: 1 },
  modalItemLabel: { fontSize: 16, fontWeight: "500", color: "#0A2342" },
  modalItemSubLabel: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: { backgroundColor: "#00C6AE", borderColor: "#00C6AE" },
  doneButton: {
    backgroundColor: "#00C6AE",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneButtonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
