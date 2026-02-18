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
import {
  usePreferences,
  LANGUAGES,
  ORIGIN_REGIONS,
  COMMUNITY_CATEGORIES,
  Community,
} from "../context/PreferencesContext";

export default function LanguageRegionScreen() {
  const navigation = useNavigation();
  const {
    preferences,
    setLanguage,
    addOriginCountry,
    removeOriginCountry,
    toggleCommunity,
    isCommunitySelected,
    isOriginSelected,
  } = usePreferences();

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showOriginModal, setShowOriginModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<(typeof ORIGIN_REGIONS)[0] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<(typeof COMMUNITY_CATEGORIES)[0] | null>(null);

  const handleLanguageSelect = async (language: (typeof LANGUAGES)[0]) => {
    await setLanguage(language);
    setShowLanguageModal(false);
  };

  const handleRegionSelect = (region: (typeof ORIGIN_REGIONS)[0]) => {
    setSelectedRegion(region);
    setShowOriginModal(false);
    setShowCountryModal(true);
  };

  const handleCountryToggle = async (country: (typeof ORIGIN_REGIONS)[0]["countries"][0]) => {
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

  const handleCategorySelect = (category: (typeof COMMUNITY_CATEGORIES)[0]) => {
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
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Language & Communities</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Language Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>APP LANGUAGE</Text>
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => setShowLanguageModal(true)}
          >
            <View style={styles.optionLeft}>
              <Text style={styles.optionFlag}>{preferences.language.flag}</Text>
              <View>
                <Text style={styles.optionLabel}>{preferences.language.name}</Text>
                <Text style={styles.optionSubLabel}>
                  {preferences.language.nativeName}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* My Communities Summary */}
        {totalSelections > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MY COMMUNITIES</Text>
              <Text style={styles.selectionCount}>{totalSelections} selected</Text>
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

        {/* Origin Country Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHERE I'M FROM</Text>
          <Text style={styles.sectionDesc}>
            Select your country/countries of origin
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowOriginModal(true)}
          >
            <Ionicons name="earth" size={24} color="#00C6AE" />
            <Text style={styles.addButtonText}>Add Origin Country</Text>
            <Ionicons name="add-circle" size={24} color="#00C6AE" />
          </TouchableOpacity>
        </View>

        {/* Community Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>JOIN COMMUNITIES</Text>
          <Text style={styles.sectionDesc}>
            Connect with people who share your interests and values
          </Text>

          {COMMUNITY_CATEGORIES.map((category) => {
            const selectedInCategory = preferences.communities.filter(
              (c) => c.category === category.id
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
                    <Text style={styles.categoryDesc}>{category.description}</Text>
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
            Your communities help us show you relevant circles and connect you
            with like-minded members. You can select multiple communities and
            update them anytime.
          </Text>
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={24} color="#0A2342" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    preferences.language.code === item.code &&
                      styles.modalItemSelected,
                  ]}
                  onPress={() => handleLanguageSelect(item)}
                >
                  <Text style={styles.modalItemFlag}>{item.flag}</Text>
                  <View style={styles.modalItemText}>
                    <Text style={styles.modalItemLabel}>{item.name}</Text>
                    <Text style={styles.modalItemSubLabel}>{item.nativeName}</Text>
                  </View>
                  {preferences.language.code === item.code && (
                    <Ionicons name="checkmark-circle" size={24} color="#00C6AE" />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* Region Selection Modal */}
      <Modal
        visible={showOriginModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOriginModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Region</Text>
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
                      {item.countries.length} countries
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

      {/* Country Selection Modal (Multi-select) */}
      <Modal
        visible={showCountryModal}
        animationType="slide"
        transparent={true}
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
                {selectedRegion?.name || "Select Countries"}
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
              Select all countries that apply
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
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Community Selection Modal (Multi-select) */}
      <Modal
        visible={showCommunityModal}
        animationType="slide"
        transparent={true}
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
                {selectedCategory?.name || "Select Communities"}
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
              Select all that apply to you
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
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
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
  selectionCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
  },
  selectedChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
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
  chipEmoji: {
    fontSize: 16,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#0A2342",
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionFlag: {
    fontSize: 28,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  optionSubLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
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
  categoryEmoji: {
    fontSize: 28,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  categoryDesc: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  categoryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: "#00C6AE",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: "center",
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#F0FDF9",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#0A2342",
    lineHeight: 20,
  },
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
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
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
  modalItemSelected: {
    backgroundColor: "#F0FDF9",
  },
  modalItemFlag: {
    fontSize: 28,
    marginRight: 12,
  },
  modalItemText: {
    flex: 1,
  },
  modalItemLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#0A2342",
  },
  modalItemSubLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#00C6AE",
    borderColor: "#00C6AE",
  },
  doneButton: {
    backgroundColor: "#00C6AE",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
