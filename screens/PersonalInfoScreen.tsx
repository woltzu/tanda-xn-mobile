import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";

export default function PersonalInfoScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { user, updateProfile, isLoading } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  // Phase 1b: city + country are direct columns on `profiles`. updateProfile
  // (from AuthContext) doesn't accept these fields, so we save them via a
  // direct supabase update inside handleSave. Initial values load from the
  // DB on mount because the auth user object doesn't carry them.
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [originalCity, setOriginalCity] = useState("");
  const [originalCountry, setOriginalCountry] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("city, country")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const c = data?.city ?? "";
      const co = data?.country ?? "";
      setCity(c);
      setCountry(co);
      setOriginalCity(c);
      setOriginalCountry(co);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const recomputeChanges = (
    n: string,
    p: string,
    c: string,
    co: string
  ): boolean =>
    n !== (user?.name || "") ||
    p !== (user?.phone || "") ||
    c !== originalCity ||
    co !== originalCountry;

  const handleNameChange = (text: string) => {
    setName(text);
    setHasChanges(recomputeChanges(text, phone, city, country));
  };

  const handlePhoneChange = (text: string) => {
    setPhone(text);
    setHasChanges(recomputeChanges(name, text, city, country));
  };

  const handleCityChange = (text: string) => {
    setCity(text);
    setHasChanges(recomputeChanges(name, phone, text, country));
  };

  const handleCountryChange = (text: string) => {
    // Country is stored as a free-form code (existing semantic: 'US', etc.).
    // Uppercase the input so it normalises consistently.
    setCountry(text.toUpperCase());
    setHasChanges(recomputeChanges(name, phone, city, text.toUpperCase()));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t("common.error"), t("personal_info.validation_name_empty"));
      return;
    }

    try {
      // Auth-context fields (name + phone) go through the existing flow.
      await updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
      });

      // city + country live directly on profiles. Empty strings → NULL so
      // the inference engine's "skip when missing" guard fires correctly.
      const cityChanged = city !== originalCity;
      const countryChanged = country !== originalCountry;
      if ((cityChanged || countryChanged) && user?.id) {
        const { error } = await supabase
          .from("profiles")
          .update({
            city: city.trim() || null,
            country: country.trim() || null,
          })
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
      }

      Alert.alert(
        t("common.success"),
        t("personal_info.save_success_body"),
        [{ text: t("common.ok"), onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert(t("common.error"), t("personal_info.save_failed_body"));
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
          {/* Profile Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={["#00C6AE", "#00A896"]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {(name || "U").charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
              <TouchableOpacity style={styles.editAvatarButton}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.changePhotoText}>{t("personal_info.change_photo")}</Text>
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

            {/* Email (Read-only) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("personal_info.email_label")}</Text>
              <View style={[styles.inputContainer, styles.inputDisabled]}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color="#9CA3AF"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.inputTextDisabled]}
                  value={user?.email || ""}
                  editable={false}
                  placeholder={t("personal_info.email_placeholder")}
                  placeholderTextColor="#9CA3AF"
                />
                <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
              </View>
              <Text style={styles.helperText}>{t("personal_info.email_helper")}</Text>
            </View>

            {/* Phone */}
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
              </View>
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

            {/* Country (Phase 1b) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("personal_info.country_label")}</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="globe-outline"
                  size={20}
                  color="#6B7280"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={country}
                  onChangeText={handleCountryChange}
                  placeholder={t("personal_info.country_placeholder")}
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  maxLength={3}
                />
              </View>
              <Text style={styles.helperText}>{t("personal_info.country_helper")}</Text>
            </View>
          </View>

          {/* XnScore Info */}
          <View style={styles.xnScoreSection}>
            <View style={styles.xnScoreCard}>
              <View style={styles.xnScoreHeader}>
                <Text style={styles.xnScoreIcon}>⭐</Text>
                <Text style={styles.xnScoreTitle}>{t("personal_info.xn_score_title")}</Text>
              </View>
              <Text style={styles.xnScoreValue}>{user?.xnScore || 15}</Text>
              <Text style={styles.xnScoreDesc}>{t("personal_info.xn_score_description")}</Text>
            </View>
          </View>
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
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0A2342",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#F5F7FA",
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
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
  helperText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 4,
  },
  xnScoreSection: {
    marginTop: 30,
  },
  xnScoreCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  xnScoreHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  xnScoreIcon: {
    fontSize: 20,
  },
  xnScoreTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  xnScoreValue: {
    fontSize: 36,
    fontWeight: "700",
    color: "#00C6AE",
    marginBottom: 8,
  },
  xnScoreDesc: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
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
