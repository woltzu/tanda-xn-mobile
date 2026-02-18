import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type PrivacySettingsNavigationProp = StackNavigationProp<RootStackParamList>;

interface VisibilityOption {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export default function PrivacySettingsScreen() {
  const navigation = useNavigation<PrivacySettingsNavigationProp>();

  const [profileVisibility, setProfileVisibility] = useState("circle_members");
  const [showSavingsAmount, setShowSavingsAmount] = useState(false);
  const [showXnScore, setShowXnScore] = useState(true);
  const [showCircleMembership, setShowCircleMembership] = useState(true);
  const [showActivityInFeed, setShowActivityInFeed] = useState(false);
  const [allowDiscovery, setAllowDiscovery] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [improvementsEnabled, setImprovementsEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  const visibilityOptions: VisibilityOption[] = [
    {
      id: "public",
      label: "Everyone",
      description: "Anyone on TandaXn can see your profile",
      icon: "globe-outline",
    },
    {
      id: "circle_members",
      label: "Circle Members Only",
      description: "Only people in your circles",
      icon: "people-outline",
    },
    {
      id: "private",
      label: "Private",
      description: "Only you can see your profile",
      icon: "lock-closed-outline",
    },
  ];

  const handleSave = () => {
    Alert.alert("Settings Saved", "Your privacy settings have been updated.");
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
              <Text style={styles.headerTitle}>Privacy</Text>
              <Text style={styles.headerSubtitle}>Control what others see</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Profile Visibility */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile Visibility</Text>
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
            <Text style={styles.sectionTitle}>What Others Can See</Text>
            <View style={styles.card}>
              <View style={[styles.toggleRow, styles.borderBottom]}>
                <View style={styles.toggleContent}>
                  <View style={styles.toggleTitleRow}>
                    <Text style={styles.toggleTitle}>Savings Amount</Text>
                    <View style={styles.sensitiveBadge}>
                      <Text style={styles.sensitiveBadgeText}>SENSITIVE</Text>
                    </View>
                  </View>
                  <Text style={styles.toggleSubtitle}>
                    Show how much you've saved
                  </Text>
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
                  <Text style={styles.toggleTitle}>XnScore Badge</Text>
                  <Text style={styles.toggleSubtitle}>
                    Display your credit score badge
                  </Text>
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
                  <Text style={styles.toggleTitle}>Circle Membership</Text>
                  <Text style={styles.toggleSubtitle}>
                    Show which circles you're in
                  </Text>
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
                  <Text style={styles.toggleTitle}>Activity in Feed</Text>
                  <Text style={styles.toggleSubtitle}>
                    Share achievements publicly
                  </Text>
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
            <Text style={styles.sectionTitle}>Discoverability</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View
                  style={[styles.toggleIcon, { backgroundColor: "#EFF6FF" }]}
                >
                  <Ionicons name="search" size={20} color="#3B82F6" />
                </View>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>Allow Discovery</Text>
                  <Text style={styles.toggleSubtitle}>
                    Let others find you by phone or email
                  </Text>
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

          {/* Data Sharing */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Sharing</Text>
            <View style={styles.card}>
              <View style={[styles.toggleRow, styles.borderBottom]}>
                <View style={styles.toggleContent}>
                  <Text style={styles.toggleTitle}>Usage Analytics</Text>
                  <Text style={styles.toggleSubtitle}>
                    Help us understand how you use the app
                  </Text>
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
                  <Text style={styles.toggleTitle}>Product Improvements</Text>
                  <Text style={styles.toggleSubtitle}>
                    Share insights to improve features
                  </Text>
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
                  <Text style={styles.toggleTitle}>Marketing Purposes</Text>
                  <Text style={styles.toggleSubtitle}>
                    Receive personalized offers
                  </Text>
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

          {/* Info Note */}
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={18} color="#00897B" />
            <Text style={styles.infoText}>
              Your financial data is never shared with third parties. We only use
              data to improve your experience and keep you safe.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Settings</Text>
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
