// ══════════════════════════════════════════════════════════════════════════════
// components/CountryPickerModal.tsx — reusable country / dial-code picker.
// ══════════════════════════════════════════════════════════════════════════════
//
// Bottom-sheet country picker for any flow that needs a phone-country prefix
// or a destination country (Remittance, Add Recipient, KYC). Renders flag +
// name + dial code with a live search filter.
//
// Callers can pass their own `countries` array (e.g. RemittanceScreen's list
// includes per-country FX rates), or fall back to `DEFAULT_COUNTRIES` —
// ~40 countries covering the most common remittance corridors + G20 majors.
//
// The Country type allows arbitrary extra metadata to ride along: a caller
// supplying `{ code, name, flag, dialCode, currency, rate }` gets the same
// object back from `onSelect` with every field intact.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/tokens";

export type Country = {
  code: string;       // ISO 3166-1 alpha-2 ("US", "SN", "GB", …)
  name: string;       // English source name (used as translation fallback)
  flag: string;       // emoji
  dialCode: string;   // "+1", "+221", "+44", …
  // Arbitrary extras (currency, rate, decimals, …) preserved on round-trip.
  // Indexed type so callers can attach domain-specific metadata.
  [key: string]: any;
};

// Default list — covers the major remittance corridors out of North America
// and Europe plus G20 economies. Callers needing different metadata (FX
// rates, currency codes) should pass a custom `countries` prop instead of
// modifying this default.
export const DEFAULT_COUNTRIES: Country[] = [
  { code: "US", name: "United States",   flag: "🇺🇸", dialCode: "+1"   },
  { code: "CA", name: "Canada",          flag: "🇨🇦", dialCode: "+1"   },
  { code: "GB", name: "United Kingdom",  flag: "🇬🇧", dialCode: "+44"  },
  { code: "FR", name: "France",          flag: "🇫🇷", dialCode: "+33"  },
  { code: "DE", name: "Germany",         flag: "🇩🇪", dialCode: "+49"  },
  { code: "ES", name: "Spain",           flag: "🇪🇸", dialCode: "+34"  },
  { code: "IT", name: "Italy",           flag: "🇮🇹", dialCode: "+39"  },
  { code: "PT", name: "Portugal",        flag: "🇵🇹", dialCode: "+351" },
  { code: "NL", name: "Netherlands",     flag: "🇳🇱", dialCode: "+31"  },
  { code: "BE", name: "Belgium",         flag: "🇧🇪", dialCode: "+32"  },
  { code: "CH", name: "Switzerland",     flag: "🇨🇭", dialCode: "+41"  },
  { code: "AU", name: "Australia",       flag: "🇦🇺", dialCode: "+61"  },
  { code: "JP", name: "Japan",           flag: "🇯🇵", dialCode: "+81"  },
  { code: "CN", name: "China",           flag: "🇨🇳", dialCode: "+86"  },
  { code: "IN", name: "India",           flag: "🇮🇳", dialCode: "+91"  },
  { code: "PH", name: "Philippines",     flag: "🇵🇭", dialCode: "+63"  },
  { code: "BD", name: "Bangladesh",      flag: "🇧🇩", dialCode: "+880" },
  { code: "PK", name: "Pakistan",        flag: "🇵🇰", dialCode: "+92"  },
  { code: "BR", name: "Brazil",          flag: "🇧🇷", dialCode: "+55"  },
  { code: "MX", name: "Mexico",          flag: "🇲🇽", dialCode: "+52"  },
  { code: "CO", name: "Colombia",        flag: "🇨🇴", dialCode: "+57"  },
  { code: "HT", name: "Haiti",           flag: "🇭🇹", dialCode: "+509" },
  { code: "JM", name: "Jamaica",         flag: "🇯🇲", dialCode: "+1876"},
  { code: "SN", name: "Senegal",         flag: "🇸🇳", dialCode: "+221" },
  { code: "CI", name: "Ivory Coast",     flag: "🇨🇮", dialCode: "+225" },
  { code: "GH", name: "Ghana",           flag: "🇬🇭", dialCode: "+233" },
  { code: "NG", name: "Nigeria",         flag: "🇳🇬", dialCode: "+234" },
  { code: "CM", name: "Cameroon",        flag: "🇨🇲", dialCode: "+237" },
  { code: "ML", name: "Mali",            flag: "🇲🇱", dialCode: "+223" },
  { code: "BF", name: "Burkina Faso",    flag: "🇧🇫", dialCode: "+226" },
  { code: "TG", name: "Togo",            flag: "🇹🇬", dialCode: "+228" },
  { code: "BJ", name: "Benin",           flag: "🇧🇯", dialCode: "+229" },
  { code: "NE", name: "Niger",           flag: "🇳🇪", dialCode: "+227" },
  { code: "GN", name: "Guinea",          flag: "🇬🇳", dialCode: "+224" },
  { code: "CD", name: "DR Congo",        flag: "🇨🇩", dialCode: "+243" },
  { code: "KE", name: "Kenya",           flag: "🇰🇪", dialCode: "+254" },
  { code: "TZ", name: "Tanzania",        flag: "🇹🇿", dialCode: "+255" },
  { code: "UG", name: "Uganda",          flag: "🇺🇬", dialCode: "+256" },
  { code: "RW", name: "Rwanda",          flag: "🇷🇼", dialCode: "+250" },
  { code: "ET", name: "Ethiopia",        flag: "🇪🇹", dialCode: "+251" },
  { code: "ZA", name: "South Africa",    flag: "🇿🇦", dialCode: "+27"  },
  { code: "MA", name: "Morocco",         flag: "🇲🇦", dialCode: "+212" },
  { code: "EG", name: "Egypt",           flag: "🇪🇬", dialCode: "+20"  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (country: Country) => void;
  /** ISO code of the currently selected country — drives the ✓ checkmark. */
  selectedCode?: string;
  /** Optional custom list. Defaults to DEFAULT_COUNTRIES. */
  countries?: Country[];
};

export default function CountryPickerModal({
  visible,
  onClose,
  onSelect,
  selectedCode,
  countries = DEFAULT_COUNTRIES,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  // Match on name, ISO code, and dial code. Dial-code matching strips a
  // leading "+" so a user typing "1" finds USA/Canada.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    const qDigits = q.replace(/^\+/, "");
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.dialCode.toLowerCase().includes(q) ||
        c.dialCode.replace(/^\+/, "").startsWith(qDigits),
    );
  }, [query, countries]);

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const handleSelect = (c: Country) => {
    setQuery("");
    onSelect(c);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>{t("country_picker.title")}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t("country_picker.close")}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t("country_picker.search_placeholder")}
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("country_picker.clear_search")}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {filtered.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons
                  name="search-outline"
                  size={32}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyText}>
                  {t("country_picker.empty")}
                </Text>
              </View>
            ) : (
              filtered.map((c) => {
                const selected = c.code === selectedCode;
                return (
                  <TouchableOpacity
                    key={c.code}
                    style={[styles.row, selected && styles.rowSelected]}
                    onPress={() => handleSelect(c)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.name} ${c.dialCode}`}
                  >
                    <Text style={styles.flag}>{c.flag}</Text>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName}>{c.name}</Text>
                      <Text style={styles.rowDial}>{c.dialCode}</Text>
                    </View>
                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.accentTeal}
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  list: {
    maxHeight: 480,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowSelected: {
    backgroundColor: colors.tealTintBg,
    borderColor: colors.accentTeal,
  },
  flag: {
    fontSize: 24,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  rowDial: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
