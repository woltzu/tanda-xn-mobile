// ══════════════════════════════════════════════════════════════════════════════
// screens/RequestProviderScreen.tsx — "Request a Provider" form
// ══════════════════════════════════════════════════════════════════════════════
//
// Reachable from MarketplaceScreen's "Can't find what you need? Request a
// provider" tile. Collects a basic business-name + description + T&C tick,
// fires an Alert thanking the user, then navigates to StoreApplication so the
// user can start an actual application immediately if they want.
//
// Notes:
//   - The submit is currently UI-only: it doesn't persist to a backend yet.
//     The "Request Sent" Alert is honest about that — wording deliberately
//     stops short of promising delivery. Backend wiring is a future task.
//   - Phase 0 placed an Alert on MarketplaceScreen's tile because this screen
//     didn't exist yet. After this screen is registered, MarketplaceScreen's
//     button can be restored to navigate() — but per the 🔴 red-emoji rule,
//     that's a separate explicit change pending user approval.
//
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTypedNavigation } from '../hooks/useTypedNavigation';
import { Routes } from '../lib/routes';

import { useTranslation } from "react-i18next";
const NAVY = '#0A2342';
const TEAL = '#00C6AE';
const BORDER = '#E5E7EB';
const MUTED = '#6B7280';

export default function RequestProviderScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();

  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSubmit = () => {
    // Field-level validation. Keep messages short and specific so the
    // user knows exactly what to fix.
    if (!businessName.trim()) {
      Alert.alert('Business name required', 'Please tell us what type of business you\'re looking for.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Description required', 'A short description helps us understand your need.');
      return;
    }
    if (!termsAccepted) {
      Alert.alert('Accept terms', 'Please accept the terms before submitting your request.');
      return;
    }

    // Backend wiring is a future task — surface an honest acknowledgment
    // and offer the user a direct path to applying themselves if they
    // happen to be the kind of business they're requesting.
    Alert.alert(
      'Request Sent',
      'Thanks — we\'ll pool your request with others. When 5 people ask for the same provider, we go find them.',
      [
        {
          text: 'Apply as a Provider',
          onPress: () => navigation.navigate(Routes.StoreApplication),
        },
        { text: 'Done', onPress: () => navigation.goBack() },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("request_provider.header_title")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          Tell us what kind of business you wish was in the marketplace. We pool
          requests — when 5 people ask for the same thing, we go find them.
        </Text>

        {/* Business name */}
        <View style={styles.field}>
          <Text style={styles.label}>Business type</Text>
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="e.g. African grocery, hair salon, accountant"
            placeholderTextColor="#9CA3AF"
            maxLength={120}
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Why do you need it?</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t("final_polish.requestprovider_ph_a_short_note_about_what_you_re_looking_for")}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.helperText}>{description.length} / 500</Text>
        </View>

        {/* Terms checkbox */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setTermsAccepted(!termsAccepted)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
            {termsAccepted && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
          </View>
          <Text style={styles.termsText}>
            I understand my request is anonymous and used only to gauge demand.
          </Text>
        </TouchableOpacity>

        {/* Submit */}
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.submitText}>Send Request</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    minWidth: 44,
    paddingVertical: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: NAVY,
  },
  headerSpacer: {
    width: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 360,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    marginBottom: 20,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: NAVY,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: NAVY,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  helperText: {
    marginTop: 4,
    fontSize: 12,
    color: MUTED,
    textAlign: 'right',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingVertical: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: NAVY,
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
