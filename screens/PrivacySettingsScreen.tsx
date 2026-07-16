import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// Phase 1c — Inference opt-out state, keyed by the two inference types
// matching the user_inference_opt_outs CHECK constraint.
type InferenceOptOuts = {
  attendance: boolean;
  location: boolean;
};

type PrivacySettingsNavigationProp = StackNavigationProp<RootStackParamList>;

interface VisibilityOption {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export default function PrivacySettingsScreen() {
  const navigation = useNavigation<PrivacySettingsNavigationProp>();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [profileVisibility, setProfileVisibility] = useState("circle_members");
  const [showSavingsAmount, setShowSavingsAmount] = useState(false);
  const [showXnScore, setShowXnScore] = useState(true);
  const [showCircleMembership, setShowCircleMembership] = useState(true);
  const [showActivityInFeed, setShowActivityInFeed] = useState(false);
  const [allowDiscovery, setAllowDiscovery] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [improvementsEnabled, setImprovementsEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  // Phase 1c — community-inference opt-out toggles. The UI mirrors the
  // ALLOW semantic (toggle ON = inference allowed), while the DB stores
  // OPT-OUT rows (presence of a row = inference DISALLOWED). The fetch /
  // setter flip the polarity at the boundary.
  const [inferenceAllowed, setInferenceAllowed] = useState<InferenceOptOuts>({
    attendance: true,
    location: true,
  });
  const [inferenceLoading, setInferenceLoading] = useState(true);
  const [savingType, setSavingType] = useState<null | keyof InferenceOptOuts>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("user_inference_opt_outs")
        .select("inference_type")
        .eq("user_id", user.id);
      if (cancelled) return;
      const optedOut = new Set(
        (data ?? []).map((r: { inference_type: string }) => r.inference_type)
      );
      setInferenceAllowed({
        attendance: !optedOut.has("attendance"),
        location: !optedOut.has("location"),
      });
      setInferenceLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleInferenceToggle = async (
    type: keyof InferenceOptOuts,
    nextAllowed: boolean
  ) => {
    const previous = inferenceAllowed[type];
    setSavingType(type);
    setInferenceAllowed((curr) => ({ ...curr, [type]: nextAllowed }));
    try {
      // Allowed=true → opt-out=false (DELETE row); allowed=false → opt-out=true (INSERT row).
      const { data, error } = await supabase.rpc("set_inference_opt_out", {
        p_inference_type: type,
        p_opt_out: !nextAllowed,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as { success?: boolean; error?: string };
      if (!r.success) throw new Error(r.error ?? "Couldn't update");
    } catch (err) {
      setInferenceAllowed((curr) => ({ ...curr, [type]: previous }));
      Alert.alert(
        t("privacy.update_failed_title"),
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setSavingType(null);
    }
  };

  // i18n: visibilityOptions built inside the component so t() re-runs
  // on language change.
  const visibilityOptions: VisibilityOption[] = [
    {
      id: "public",
      label: t("privacy.visibility_everyone"),
      description: t("privacy.visibility_everyone_desc"),
      icon: "globe-outline",
    },
    {
      id: "circle_members",
      label: t("privacy.visibility_circle"),
      description: t("privacy.visibility_circle_desc"),
      icon: "people-outline",
    },
    {
      id: "private",
      label: t("privacy.visibility_private"),
      description: t("privacy.visibility_private_desc"),
      icon: "lock-closed-outline",
    },
  ];

  const handleSave = () => {
    Alert.alert(
      t("privacy.save_success_title"),
      t("privacy.save_success_body"),
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>{t("privacy.header")}</Text>
              <Text style={styles.headerSubtitle}>{t("privacy.subtitle")}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Profile Visibility */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("privacy.section_visibility")}</Text>
            <View style={styles.card}>
              {visibilityOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.visibilityOption,
                    profileVisibility === option.id && styles.visibilityOptionSelected,
                  ]}
                  onPress={() => setProfileVisibility(option.id)}
                >
                  <View
                    style={[
                      styles.visibilityIcon,
                      {
                        backgroundColor:
                          profileVisibility === option.id ? "#F0FDFB" : "#F5F7FA",
                      },
                    ]}
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color={profileVisibility === option.id ? "#00C6AE" : "#6B7280"}
                    />
                  </View>
                  <View style={styles.visibilityContent}>
                    <Text style={styles.visibilityLabel}>{option.label}</Text>
                    <Text style={styles.visibilityDescription}>
                      {option.description}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioCircle,
                      profileVisibility === option.id && styles.radioCircleSelected,
                    ]}
                  >
                    {profileVisibility === option.id && (
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* What Others See */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("privacy.section_what_others_see")}</Text>
            <View style={styles.card}>
              <View style={[styles.toggleRow, styles.borderBottom]}>
                <View style={styles.toggleContent}>
                  <View style={styles.toggleTitleRow}>
                    <Text style={styles.toggleTitle}>{t("privacy.toggle_savings")}</Text>
                    <View style={styles.sensitiveBadge}>
                      <Text style={styles.sensitiveBadgeText}>{t("privacy.toggle_savings_badge")}</Text>
                    </View>
                  </View>
                  <Text style={styles.toggleSubtitle}>{t("privacy.toggle_savings_desc")}</Text>
                </View>
                <Switch
                  value={showSavingsAmount}
                  onValueChange={setShowSavingsAmount}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.toggleRow, styles.borderBottom]}>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>{t("privacy.toggle_xn_score")}</Text>
                  <Text style={styles.toggleSubtitle}>{t("privacy.toggle_xn_score_desc")}</Text>
                </View>
                <Switch
                  value={showXnScore}
                  onValueChange={setShowXnScore}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.toggleRow, styles.borderBottom]}>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>{t("privacy.toggle_circle_membership")}</Text>
                  <Text style={styles.toggleSubtitle}>{t("privacy.toggle_circle_membership_desc")}</Text>
                </View>
                <Switch
                  value={showCircleMembership}
                  onValueChange={setShowCircleMembership}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>{t("privacy.toggle_activity_feed")}</Text>
                  <Text style={styles.toggleSubtitle}>{t("privacy.toggle_activity_feed_desc")}</Text>
                </View>
                <Switch
                  value={showActivityInFeed}
                  onValueChange={setShowActivityInFeed}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          {/* Discoverability */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("privacy.section_discoverability")}</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View
                  style={[styles.toggleIcon, { backgroundColor: "#EFF6FF" }]}
                >
                  <Ionicons name="search" size={20} color="#3B82F6" />
                </View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>{t("privacy.toggle_discovery")}</Text>
                  <Text style={styles.toggleSubtitle}>{t("privacy.toggle_discovery_desc")}</Text>
                </View>
                <Switch
                  value={allowDiscovery}
                  onValueChange={setAllowDiscovery}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          {/* Phase 1c — Community Suggestions opt-outs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("privacy.section_community_suggestions")}</Text>
            <View style={styles.card}>
              <View style={[styles.toggleRow, styles.borderBottom]}>
                <View style={[styles.toggleIcon, { backgroundColor: "#F5F3FF" }]}>
                  <Ionicons name="videocam-outline" size={20} color="#7C3AED" />
                </View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>{t("privacy.toggle_inference_attendance")}</Text>
                  <Text style={styles.toggleSubtitle}>{t("privacy.toggle_inference_attendance_desc")}</Text>
                </View>
                {savingType === "attendance" ? (
                  <ActivityIndicator color="#7C3AED" size="small" />
                ) : (
                  <Switch
                    value={inferenceAllowed.attendance}
                    onValueChange={(v) => handleInferenceToggle("attendance", v)}
                    disabled={inferenceLoading}
                    trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                    thumbColor="#FFFFFF"
                  />
                )}
              </View>

              <View style={styles.toggleRow}>
                <View style={[styles.toggleIcon, { backgroundColor: "#E0F2FE" }]}>
                  <Ionicons name="location-outline" size={20} color="#0EA5E9" />
                </View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>{t("privacy.toggle_inference_location")}</Text>
                  <Text style={styles.toggleSubtitle}>{t("privacy.toggle_inference_location_desc")}</Text>
                </View>
                {savingType === "location" ? (
                  <ActivityIndicator color="#0EA5E9" size="small" />
                ) : (
                  <Switch
                    value={inferenceAllowed.location}
                    onValueChange={(v) => handleInferenceToggle("location", v)}
                    disabled={inferenceLoading}
                    trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                    thumbColor="#FFFFFF"
                  />
                )}
              </View>
            </View>
          </View>

          {/* Data Sharing */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("privacy.section_data_sharing")}</Text>
            <View style={styles.card}>
              <View style={[styles.toggleRow, styles.borderBottom]}>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>{t("privacy.toggle_analytics")}</Text>
                  <Text style={styles.toggleSubtitle}>{t("privacy.toggle_analytics_desc")}</Text>
                </View>
                <Switch
                  value={analyticsEnabled}
                  onValueChange={setAnalyticsEnabled}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.toggleRow, styles.borderBottom]}>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>{t("privacy.toggle_improvements")}</Text>
                  <Text style={styles.toggleSubtitle}>{t("privacy.toggle_improvements_desc")}</Text>
                </View>
                <Switch
                  value={improvementsEnabled}
                  onValueChange={setImprovementsEnabled}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>{t("privacy.toggle_marketing")}</Text>
                  <Text style={styles.toggleSubtitle}>{t("privacy.toggle_marketing_desc")}</Text>
                </View>
                <Switch
                  value={marketingEnabled}
                  onValueChange={setMarketingEnabled}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          {/* Phase 5 — Blocked Users management. Entry point to a
              dedicated screen listing everyone the caller has blocked
              via the mig 346 blocked_users table. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>People</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => navigation.navigate("BlockedUsers")}
                accessibilityRole="button"
                accessibilityLabel="Blocked Users"
              >
                <View style={styles.navRowIconWrap}>
                  <Ionicons name="ban-outline" size={20} color="#DC2626" />
                </View>
                <View style={styles.navRowBody}>
                  <Text style={styles.navRowTitle}>Blocked Users</Text>
                  <Text style={styles.navRowSubtitle}>
                    Manage who can't see your content
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Info Note */}
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={18} color="#00897B" />
            <Text style={styles.infoText}>{t("privacy.info_text")}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{t("privacy.save_button")}</Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  visibilityOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  visibilityOptionSelected: {
    backgroundColor: "#F0FDFB",
  },
  visibilityIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  visibilityContent: {
    flex: 1,
  },
  visibilityLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  visibilityDescription: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    backgroundColor: "#00C6AE",
    borderColor: "#00C6AE",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleContent: {
    flex: 1,
  },
  toggleTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0A2342",
  },
  toggleSubtitle: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 1,
  },
  sensitiveBadge: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 3,
  },
  sensitiveBadgeText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#D97706",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDFB",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  navRowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  navRowBody: {
    flex: 1,
  },
  navRowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  navRowSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
    lineHeight: 18,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  saveButton: {
    backgroundColor: "#00C6AE",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
