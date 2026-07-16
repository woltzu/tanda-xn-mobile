import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import * as Localization from "expo-localization";
import { supabase } from "../lib/supabase";
import { showToast } from "../components/Toast";
import { useProfile } from "../hooks/useProfile";
import CountryPicker, {
  findCountryByCode,
} from "../components/CountryPicker";
import EmailChangeModal from "../components/EmailChangeModal";
import type { RootStackParamList } from "../App";

type Nav = StackNavigationProp<RootStackParamList>;

export default function PersonalInfoScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { user, updateProfile, requestPhoneChange, isLoading } = useAuth();
  // P1 (profile review): central fetch, 60 s cache.
  const { profile, refetch: refetchProfile } = useProfile();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState("");
  // P1: country is now an ISO 3166-1 alpha-2 code from CountryPicker.
  // Freeform input + interim regex check from P0 are both gone.
  const [country, setCountry] = useState("");
  const [originalCity, setOriginalCity] = useState("");
  const [originalCountry, setOriginalCountry] = useState("");
  // Phase 6 — heritage/origin fields. Writes to these two columns fire
  // mig 344's tr_auto_assign_on_profile_change and enroll the user into
  // the matching country + city communities. Country is an ISO alpha-2
  // code from CountryPicker (matches the current-country picker). City
  // is a freeform string.
  const [cityOfOrigin, setCityOfOrigin] = useState("");
  const [countryOfOrigin, setCountryOfOrigin] = useState("");
  const [originalCityOfOrigin, setOriginalCityOfOrigin] = useState("");
  const [originalCountryOfOrigin, setOriginalCountryOfOrigin] = useState("");
  const [originCountryPickerOpen, setOriginCountryPickerOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [avatarErrored, setAvatarErrored] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  // P2: editable email + phone verification + auto-detect country.
  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [pendingNewEmail, setPendingNewEmail] = useState<string | null>(null);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  // P2.8: device-detected country code, surfaced as a hint chip when
  // profiles.country was empty on first mount.
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const avatarUrl = profile?.avatar_url ?? null;
  // True once profiles.phone_verified flips. Drives the green pill.
  const phoneVerified = !!profile?.phone_verified;
  // True iff the saved (verified) phone matches what's in the input —
  // editing the field drops the badge until the next OTP success.
  const phoneMatchesSaved = (profile?.phone ?? "") === phone;
  // Phone is verifiable when the input has a value and either the
  // verified flag is false OR the user has edited the field since the
  // last verification.
  const canVerifyPhone = phone.trim().length >= 6 && (!phoneVerified || !phoneMatchesSaved);

  // Hydrate edits state from the central profile snapshot. Tracks
  // changes against the latest `profile` so cache refreshes after
  // saving land correctly.
  useEffect(() => {
    if (!profile) return;
    const c = profile.city ?? "";
    const co = (profile.country ?? "").toUpperCase();
    setCity(c);
    setCountry(co);
    setOriginalCity(c);
    setOriginalCountry(co);
    // Phase 6 — hydrate origin fields. Country_of_origin is stored as
    // an ISO code (same convention as `country`); city_of_origin is a
    // freeform string. Both nullable → default to "".
    const oc = (profile.city_of_origin ?? "").toString();
    const oco = (profile.country_of_origin ?? "").toUpperCase();
    setCityOfOrigin(oc);
    setCountryOfOrigin(oco);
    setOriginalCityOfOrigin(oc);
    setOriginalCountryOfOrigin(oco);
    setAvatarErrored(false);
    // Mirror profile.phone into the editable input — important after
    // OTP success bumps profile.phone via the migration 167 trigger.
    if (profile.phone !== null) setPhone(profile.phone);

    // P2.8: if profile.country is empty, pre-fill the picker from the
    // device region and surface it as an info chip. We do NOT write to
    // the DB here — the user has to actually save (or change country)
    // to commit. This keeps "auto-detection" feeling suggestive rather
    // than silently writing data the user didn't ask for.
    if (!co) {
      try {
        const locales = Localization.getLocales();
        const region = locales?.[0]?.regionCode?.toUpperCase() ?? null;
        if (region && findCountryByCode(region)) {
          setCountry(region);
          setDetectedCountry(region);
          // Surface in hasChanges so Save lights up — user can choose
          // to accept or open the picker to override.
          setHasChanges(true);
        }
      } catch {
        // Localization can throw on web bundles missing the polyfill;
        // skip silently.
      }
    }
  }, [profile?.city, profile?.country, profile?.avatar_url, profile?.phone]);

  // P2 (profile review): refetch profile every time the screen gets
  // focus. OTPScreen's profile_edit flow flips phone_verified inside
  // AuthContext, then pops back here — without this refetch the
  // cached snapshot from useProfile would hide the change for up to
  // its 60-s TTL.
  useFocusEffect(
    useCallback(() => {
      refetchProfile();
    }, [refetchProfile]),
  );

  // P2: check Supabase for a pending email change. auth.users.new_email
  // is populated between requestEmailChange and the link click. The
  // value persists across mounts, so we refresh on focus.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        const newEmail = (data?.user as any)?.new_email ?? null;
        setPendingNewEmail(newEmail || null);
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const recomputeChanges = (
    n: string,
    p: string,
    c: string,
    co: string,
    oc: string,
    oco: string,
  ): boolean =>
    n !== (user?.name || "") ||
    p !== (user?.phone || "") ||
    c !== originalCity ||
    co !== originalCountry ||
    oc !== originalCityOfOrigin ||
    oco !== originalCountryOfOrigin;

  const handleNameChange = (text: string) => {
    setName(text);
    setHasChanges(
      recomputeChanges(text, phone, city, country, cityOfOrigin, countryOfOrigin),
    );
  };

  const handlePhoneChange = (text: string) => {
    setPhone(text);
    setHasChanges(
      recomputeChanges(name, text, city, country, cityOfOrigin, countryOfOrigin),
    );
  };

  const handleCityChange = (text: string) => {
    setCity(text);
    setHasChanges(
      recomputeChanges(name, phone, text, country, cityOfOrigin, countryOfOrigin),
    );
  };

  const handleCountryPick = (code: string) => {
    // P1: code is guaranteed to be a valid ISO 3166-1 alpha-2 because
    // it came from the static picker list. No regex validation needed.
    setCountry(code);
    setHasChanges(
      recomputeChanges(name, phone, city, code, cityOfOrigin, countryOfOrigin),
    );
    setCountryPickerOpen(false);
    // User overrode the auto-detected suggestion — drop the chip so we
    // stop telling them about a value they already replaced.
    setDetectedCountry(null);
  };

  const handleCityOfOriginChange = (text: string) => {
    setCityOfOrigin(text);
    setHasChanges(
      recomputeChanges(name, phone, city, country, text, countryOfOrigin),
    );
  };

  const handleCountryOfOriginPick = (code: string) => {
    setCountryOfOrigin(code);
    setHasChanges(
      recomputeChanges(name, phone, city, country, cityOfOrigin, code),
    );
    setOriginCountryPickerOpen(false);
  };

  // P2 (profile review): kick off the SMS OTP for the current phone
  // input, then route to OTPScreen with from='profile_edit'. On success
  // OTPScreen pops back here and useProfile refetch surfaces the
  // verified flag. If anything fails before navigation we surface a
  // toast — once on the OTP screen, errors are handled there.
  const handleVerifyPhone = async () => {
    const trimmed = phone.trim();
    if (trimmed.length < 6) {
      showToast(t("personal_info.phone_verify_invalid"), "error");
      return;
    }
    setVerifyingPhone(true);
    try {
      await requestPhoneChange(trimmed);
      navigation.navigate("OTP", { phone: trimmed, from: "profile_edit" });
    } catch (e: any) {
      showToast(
        e?.message || t("personal_info.phone_verify_request_failed"),
        "error",
      );
    } finally {
      setVerifyingPhone(false);
    }
  };

  // P2: after EmailChangeModal succeeds, hold the pending address in
  // local state so the badge renders immediately. The mount-time
  // getUser() effect refreshes it from auth.users.new_email on next
  // open in case the user clicked through and came back.
  const handleEmailChangeSubmitted = (newEmail: string) => {
    setPendingNewEmail(newEmail);
    showToast(t("email_change.toast_sent"), "success");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast(t("personal_info.validation_name_empty"), "error");
      return;
    }

    // P1 (profile review): country is picker-driven now, so its value
    // is either empty (optional, allowed) or a valid ISO 3166-1
    // alpha-2 code. Interim P0 regex check is gone.
    const trimmedCountry = country.trim();

    try {
      // Auth-context fields (name + phone) go through the existing flow.
      await updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
      });

      // city + country + city_of_origin + country_of_origin all live
      // directly on profiles. Empty strings → NULL so:
      //   * the inference engine's "skip when missing" guard fires (city/country)
      //   * mig 344's auto-assign trigger's IS NOT NULL AND <> '' guard skips
      //     when origin is cleared (country_of_origin/city_of_origin)
      const cityChanged = city !== originalCity;
      const countryChanged = country !== originalCountry;
      const cityOfOriginChanged = cityOfOrigin !== originalCityOfOrigin;
      const countryOfOriginChanged = countryOfOrigin !== originalCountryOfOrigin;
      const originChanged = cityOfOriginChanged || countryOfOriginChanged;
      if (
        (cityChanged || countryChanged || originChanged) &&
        user?.id
      ) {
        const payload: Record<string, string | null> = {};
        if (cityChanged) payload.city = city.trim() || null;
        if (countryChanged) payload.country = trimmedCountry || null;
        if (cityOfOriginChanged) {
          payload.city_of_origin = cityOfOrigin.trim() || null;
        }
        if (countryOfOriginChanged) {
          payload.country_of_origin = countryOfOrigin.trim() || null;
        }
        const { error } = await supabase
          .from("profiles")
          .update(payload)
          .eq("id", user.id);
        if (error) throw error;

        // Best-effort location inference. Phase 1b: kicks off whenever
        // the user updates location with a non-empty city — server-side
        // creates the suggestion. Errors are non-fatal because the
        // profile update itself succeeded.
        if (city.trim()) {
          await supabase
            .rpc("infer_groups_for_user", {
              p_event_type: "location",
              p_event_data: {},
            })
            .then(() => null)
            .catch(() => null);
        }

        // Phase 6 — surface auto-assignment as its own toast so the
        // user knows why they suddenly appear in new communities. The
        // trigger fires server-side inside the UPDATE transaction; we
        // don't need to await anything here, just tell them what to
        // expect. Only shown when either origin field was actually
        // changed to a non-empty value.
        if (
          originChanged &&
          ((cityOfOriginChanged && cityOfOrigin.trim()) ||
            (countryOfOriginChanged && countryOfOrigin.trim()))
        ) {
          showToast("Adding you to matching communities…", "info");
        }
      }

      // P2: refresh the cached profile so a return visit reflects the
      // new name/phone without waiting for the 60-s TTL.
      await refetchProfile();
      // P0: swap the Alert+OK round-trip for a non-blocking toast and
      // immediately pop back. User lands on ProfileScreen with the
      // confirmation hanging on top of the rendered view.
      showToast(t("personal_info.save_success_body"), "success");
      navigation.goBack();
    } catch (error) {
      showToast(t("personal_info.save_failed_body"), "error");
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("personal_info.header")}</Text>
            <View style={styles.placeholder} />
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Avatar (P0 review): real avatar from
              profiles.avatar_url with initial-letter fallback. The
              dead camera button + "Change photo" affordance was
              removed — P1 will wire a working picker. */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {avatarUrl && !avatarErrored ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatar}
                  onError={() => setAvatarErrored(true)}
                />
              ) : (
                <LinearGradient
                  colors={["#00C6AE", "#00A896"]}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>
                    {(name || "U").charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
            </View>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("personal_info.full_name_label")}</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#6B7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={handleNameChange}
                  placeholder={t("personal_info.full_name_placeholder")}
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email — P2: tappable. Opens EmailChangeModal which fires
                supabase.auth.updateUser({ email }). Renders a "Pending
                verification" pill when auth.users.new_email exists. */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("personal_info.email_label")}</Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setEmailChangeOpen(true)}
                accessibilityRole="button"
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color="#6B7280"
                  style={styles.inputIcon}
                />
                <Text style={styles.input} numberOfLines={1}>
                  {user?.email || t("personal_info.email_placeholder")}
                </Text>
                {pendingNewEmail ? (
                  <View style={styles.pendingPill}>
                    <Ionicons name="time-outline" size={11} color="#92400E" />
                    <Text style={styles.pendingPillText}>
                      {t("personal_info.email_pending_pill")}
                    </Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
              <Text style={styles.helperText}>
                {pendingNewEmail
                  ? t("personal_info.email_pending_helper", {
                      email: pendingNewEmail,
                    })
                  : t("personal_info.email_tap_helper")}
              </Text>
            </View>

            {/* Phone — P2: Verify pill (teal) when there's an
                unverified number in the input; Verified pill (green)
                when profile.phone_verified is true AND the input
                matches the saved number. Editing the field drops the
                verified state until re-verified. */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("personal_info.phone_label")}</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="call-outline"
                  size={20}
                  color="#6B7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  placeholder={t("personal_info.phone_placeholder")}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
                {phoneVerified && phoneMatchesSaved ? (
                  <View style={styles.verifiedPill}>
                    <Ionicons
                      name="checkmark-circle"
                      size={12}
                      color="#047857"
                    />
                    <Text style={styles.verifiedPillText}>
                      {t("personal_info.phone_verified_pill")}
                    </Text>
                  </View>
                ) : canVerifyPhone ? (
                  <TouchableOpacity
                    style={styles.verifyPill}
                    onPress={handleVerifyPhone}
                    disabled={verifyingPhone}
                  >
                    {verifyingPhone ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.verifyPillText}>
                        {t("personal_info.phone_verify_pill")}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
              {phoneVerified && !phoneMatchesSaved ? (
                <Text style={styles.helperText}>
                  {t("personal_info.phone_changed_helper")}
                </Text>
              ) : null}
            </View>

            {/* City (Phase 1b) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("personal_info.city_label")}</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color="#6B7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={handleCityChange}
                  placeholder={t("personal_info.city_placeholder")}
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                />
              </View>
              <Text style={styles.helperText}>{t("personal_info.city_helper")}</Text>
            </View>

            {/* Country — P1 picker. Tap to open the ISO 3166-1 alpha-2
                modal; the chip on the right shows the current code, the
                main label shows the display name. */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {t("personal_info.country_label")}
              </Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setCountryPickerOpen(true)}
                accessibilityRole="button"
              >
                <Ionicons
                  name="globe-outline"
                  size={20}
                  color="#6B7280"
                  style={styles.inputIcon}
                />
                <Text
                  style={[
                    styles.input,
                    !country && styles.countryPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {country
                    ? findCountryByCode(country)?.name ?? country
                    : t("country_picker.tap_to_choose")}
                </Text>
                {country ? (
                  <Text style={styles.countryCodeChip}>{country}</Text>
                ) : null}
                <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
              </TouchableOpacity>
              {detectedCountry ? (
                // P2.8 (profile review): info chip the first time we
                // auto-detect from device locale. Disappears on
                // override (handleCountryPick clears it).
                <View style={styles.detectedChip}>
                  <Ionicons name="locate" size={12} color="#1E40AF" />
                  <Text style={styles.detectedChipText}>
                    {t("personal_info.country_detected_chip", {
                      code: detectedCountry,
                    })}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.helperText}>
                {t("personal_info.country_helper")}
              </Text>
            </View>

            {/* Phase 6 — Where you're from. Editing either field fires
                mig 344's tr_auto_assign_on_profile_change trigger and
                enrolls the user into the matching country/city
                communities. Distinct from Current City / Current
                Country above, which stay tied to the user's present
                location (community-inference and localization). */}
            <View style={styles.originSectionHeader}>
              <Text style={styles.sectionTitle}>Where you're from</Text>
              <Text style={styles.sectionSubtitle}>
                We use this to add you to your heritage communities so
                you can meet people from the same country or hometown.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Country of origin</Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setOriginCountryPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Country of origin"
              >
                <Ionicons
                  name="earth-outline"
                  size={20}
                  color="#6B7280"
                  style={styles.inputIcon}
                />
                <Text
                  style={[
                    styles.input,
                    !countryOfOrigin && styles.countryPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {countryOfOrigin
                    ? findCountryByCode(countryOfOrigin)?.name ??
                      countryOfOrigin
                    : "Tap to choose"}
                </Text>
                {countryOfOrigin ? (
                  <Text style={styles.countryCodeChip}>
                    {countryOfOrigin}
                  </Text>
                ) : null}
                <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>City of origin</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="home-outline"
                  size={20}
                  color="#6B7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={cityOfOrigin}
                  onChangeText={handleCityOfOriginChange}
                  placeholder="Hometown"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                />
              </View>
              <Text style={styles.helperText}>
                Your hometown or place of birth. Optional.
              </Text>
            </View>
          </View>

          {/* P0 (profile review): XnScore card removed — duplicated the
              one already on ProfileScreen's header. */}
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              !hasChanges && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!hasChanges || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>{t("personal_info.save_changes")}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <CountryPicker
        visible={countryPickerOpen}
        currentCode={country}
        onPick={handleCountryPick}
        onClose={() => setCountryPickerOpen(false)}
      />

      <CountryPicker
        visible={originCountryPickerOpen}
        currentCode={countryOfOrigin}
        onPick={handleCountryOfOriginPick}
        onClose={() => setOriginCountryPickerOpen(false)}
      />

      <EmailChangeModal
        visible={emailChangeOpen}
        currentEmail={user?.email || ""}
        onClose={() => setEmailChangeOpen(false)}
        onSubmitted={handleEmailChangeSubmitted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  keyboardView: {
    flex: 1,
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
    paddingBottom: 100,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 40,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  formSection: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    height: 56,
  },
  inputDisabled: {
    backgroundColor: "#F9FAFB",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#0A2342",
  },
  inputTextDisabled: {
    color: "#9CA3AF",
  },
  countryPlaceholder: {
    color: "#9CA3AF",
  },
  countryCodeChip: {
    fontSize: 12,
    fontWeight: "800",
    color: "#374151",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
    letterSpacing: 0.5,
  },
  // P2 (profile review) — inline status / action pills inside the
  // phone + email rows.
  verifyPill: {
    backgroundColor: "#00C6AE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyPillText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  verifiedPillText: { fontSize: 11, fontWeight: "700", color: "#047857" },
  pendingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 4,
  },
  pendingPillText: { fontSize: 11, fontWeight: "700", color: "#92400E" },
  detectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginLeft: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
  },
  detectedChipText: { fontSize: 11, fontWeight: "700", color: "#1E40AF" },
  helperText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
  // Phase 6 — origin section header sits between the current-location
  // fields and the origin fields to break the form into two clear
  // groups.
  originSectionHeader: {
    marginTop: 12,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A2342",
    marginLeft: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
    lineHeight: 18,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 34,
    backgroundColor: "#F5F7FA",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  saveButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
