import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCurrency, CURRENCIES, CURRENCY_REGIONS } from "../context/CurrencyContext";

interface CurrencySelectorProps {
  selectedCurrency: string;
  onSelect: (currencyCode: string) => void;
  label?: string;
  showBalance?: boolean;
  balance?: number;
  disabled?: boolean;
  compact?: boolean;
}

export function CurrencySelector({
  selectedCurrency,
  onSelect,
  label,
  showBalance = false,
  balance,
  disabled = false,
  compact = false,
}: CurrencySelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { getCurrency, formatCurrency, recentCurrencies } = useCurrency();

  const currency = getCurrency(selectedCurrency);

  const handleSelect = (code: string) => {
    onSelect(code);
    setModalVisible(false);
    setSearchQuery("");
  };

  const filteredCurrencies = Object.values(CURRENCIES).filter(
    (c) =>
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group filtered currencies by region
  const groupedCurrencies = Object.entries(CURRENCY_REGIONS).reduce(
    (acc, [region, codes]) => {
      const regionCurrencies = codes.filter((code) =>
        filteredCurrencies.some((c) => c.code === code)
      );
      if (regionCurrencies.length > 0) {
        acc[region] = regionCurrencies;
      }
      return acc;
    },
    {} as Record<string, string[]>
  );

  if (compact) {
    return (
      <>
        <TouchableOpacity
          style={styles.compactSelector}
          onPress={() => !disabled && setModalVisible(true)}
          disabled={disabled}
        >
          <Text style={styles.compactFlag}>{currency?.flag || "🏳️"}</Text>
          <Text style={styles.compactCode}>{selectedCurrency}</Text>
          <Ionicons name="chevron-down" size={14} color="#6B7280" />
        </TouchableOpacity>

        <CurrencyModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSelect={handleSelect}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          groupedCurrencies={groupedCurrencies}
          recentCurrencies={recentCurrencies}
          selectedCurrency={selectedCurrency}
        />
      </>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, disabled && styles.selectorDisabled]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        {label && <Text style={styles.label}>{label}</Text>}
        <View style={styles.selectorContent}>
          <View style={styles.currencyInfo}>
            <Text style={styles.flag}>{currency?.flag || "🏳️"}</Text>
            <View>
              <Text style={styles.currencyCode}>{selectedCurrency}</Text>
              <Text style={styles.currencyName}>{currency?.name || "Select currency"}</Text>
            </View>
          </View>
          <View style={styles.selectorRight}>
            {showBalance && balance !== undefined && (
              <Text style={styles.balance}>
                {currency?.symbol}{formatCurrency(balance, selectedCurrency)}
              </Text>
            )}
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </View>
        </View>
      </TouchableOpacity>

      <CurrencyModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSelect={handleSelect}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        groupedCurrencies={groupedCurrencies}
        recentCurrencies={recentCurrencies}
        selectedCurrency={selectedCurrency}
      />
    </>
  );
}

// Currency List Modal Component
interface CurrencyModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (code: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  groupedCurrencies: Record<string, string[]>;
  recentCurrencies: string[];
  selectedCurrency: string;
}

function CurrencyModal({
  visible,
  onClose,
  onSelect,
  searchQuery,
  setSearchQuery,
  groupedCurrencies,
  recentCurrencies,
  selectedCurrency,
}: CurrencyModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Currency</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#0A2342" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search currency or region..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.currencyList} showsVerticalScrollIndicator={false}>
            {/* Recent Currencies */}
            {recentCurrencies.length > 0 && !searchQuery && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent</Text>
                {recentCurrencies.map((code) => {
                  const currency = CURRENCIES[code];
                  if (!currency) return null;
                  return (
                    <CurrencyItem
                      key={code}
                      currency={currency}
                      isSelected={code === selectedCurrency}
                      onSelect={() => onSelect(code)}
                    />
                  );
                })}
              </View>
            )}

            {/* Currencies by Region */}
            {Object.entries(groupedCurrencies).map(([region, codes]) => (
              <View key={region} style={styles.section}>
                <Text style={styles.sectionTitle}>{region}</Text>
                {codes.map((code) => {
                  const currency = CURRENCIES[code];
                  if (!currency) return null;
                  return (
                    <CurrencyItem
                      key={code}
                      currency={currency}
                      isSelected={code === selectedCurrency}
                      onSelect={() => onSelect(code)}
                    />
                  );
                })}
              </View>
            ))}

            {Object.keys(groupedCurrencies).length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="search" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No currencies found</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Single Currency Item
interface CurrencyItemProps {
  currency: {
    code: string;
    name: string;
    flag: string;
    symbol: string;
    region: string;
  };
  isSelected: boolean;
  onSelect: () => void;
}

function CurrencyItem({ currency, isSelected, onSelect }: CurrencyItemProps) {
  return (
    <TouchableOpacity
      style={[styles.currencyItem, isSelected && styles.currencyItemSelected]}
      onPress={onSelect}
    >
      <Text style={styles.itemFlag}>{currency.flag}</Text>
      <View style={styles.itemInfo}>
        <Text style={styles.itemCode}>{currency.code}</Text>
        <Text style={styles.itemName}>{currency.name}</Text>
      </View>
      <Text style={styles.itemSymbol}>{currency.symbol}</Text>
      {isSelected && (
        <Ionicons name="checkmark-circle" size={20} color="#00C6AE" />
      )}
    </TouchableOpacity>
  );
}

// Quick Currency Picker (horizontal scroll)
interface QuickCurrencyPickerProps {
  selectedCurrency: string;
  onSelect: (code: string) => void;
  currencies?: string[];
}

export function QuickCurrencyPicker({
  selectedCurrency,
  onSelect,
  currencies = ["USD", "EUR", "GBP", "XOF", "NGN", "KES"],
}: QuickCurrencyPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.quickPicker}
    >
      {currencies.map((code) => {
        const currency = CURRENCIES[code];
        if (!currency) return null;
        const isSelected = code === selectedCurrency;

        return (
          <TouchableOpacity
            key={code}
            style={[styles.quickChip, isSelected && styles.quickChipSelected]}
            onPress={() => onSelect(code)}
          >
            <Text style={styles.quickFlag}>{currency.flag}</Text>
            <Text style={[styles.quickCode, isSelected && styles.quickCodeSelected]}>
              {code}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Main Selector
  selector: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
  },
  selectorDisabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  selectorContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  currencyInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flag: {
    fontSize: 32,
  },
  currencyCode: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
  },
  currencyName: {
    fontSize: 13,
    color: "#6B7280",
  },
  selectorRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  balance: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },

  // Compact Selector
  compactSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  compactFlag: {
    fontSize: 16,
  },
  compactCode: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A2342",
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    margin: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: "#0A2342",
  },

  // Currency List
  currencyList: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  currencyItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  currencyItemSelected: {
    backgroundColor: "rgba(0,198,174,0.1)",
    borderWidth: 1,
    borderColor: "#00C6AE",
  },
  itemFlag: {
    fontSize: 24,
  },
  itemInfo: {
    flex: 1,
  },
  itemCode: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  itemName: {
    fontSize: 12,
    color: "#6B7280",
  },
  itemSymbol: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
    marginRight: 8,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 15,
    color: "#9CA3AF",
    marginTop: 12,
  },

  // Quick Picker
  quickPicker: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 10,
    gap: 6,
  },
  quickChipSelected: {
    backgroundColor: "#00C6AE",
  },
  quickFlag: {
    fontSize: 16,
  },
  quickCode: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  quickCodeSelected: {
    color: "#FFFFFF",
  },
});
