import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type SecuritySettingsNavigationProp = StackNavigationProp<RootStackParamList>;

export default function SecuritySettingsScreen() {
  const navigation = useNavigation<SecuritySettingsNavigationProp>();

  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [transactionAlerts, setTransactionAlerts] = useState(true);

  // Security score based on settings
  const calculateSecurityScore = () => {
    let score = 50; // Base score
    if (biometricsEnabled) score += 20;
    if (loginAlerts) score += 15;
    if (transactionAlerts) score += 15;
    return score;
  };

  const securityScore = calculateSecurityScore();

  const getScoreColor = (score: number) => {
    if (score >= 90) return "#00C6AE";
    if (score >= 70) return "#00897B";
    if (score >= 50) return "#D97706";
    return "#DC2626";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 50) return "Fair";
    return "Needs Improvement";
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Security</Text>
              <Text style={styles.headerSubtitle}>Protect your account</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Security Score */}
          <View style={styles.scoreCard}>
            <View style={styles.scoreCircle}>
              <Text style={[styles.scoreValue, { color: getScoreColor(securityScore) }]}>
                {securityScore}
              </Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
            <View style={styles.scoreInfo}>
              <Text style={styles.scoreLabel}>Security Score</Text>
              <Text style={[styles.scoreStatus, { color: getScoreColor(securityScore) }]}>
                {getScoreLabel(securityScore)}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Password Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Password</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate("ChangePassword" as any)}
              >
                <View style={[styles.menuIcon, { backgroundColor: "#F0FDFB" }]}>
                  <Ionicons name="key-outline" size={20} color="#00C6AE" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>Change Password</Text>
                  <Text style={styles.menuSubtitle}>Last changed 30 days ago</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Two-Factor Authentication */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Two-Factor Authentication</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate("TwoFactorAuth" as any)}
              >
                <View style={[styles.menuIcon, { backgroundColor: "#F0FDFB" }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#00C6AE" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>2FA Settings</Text>
                  <Text style={styles.menuSubtitle}>Authenticator app enabled</Text>
                </View>
                <View style={styles.enabledBadge}>
                  <Text style={styles.enabledText}>Enabled</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Biometrics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Biometrics</Text>
            <View style={styles.card}>
              <View style={styles.toggleItem}>
                <View style={[styles.menuIcon, { backgroundColor: "#EFF6FF" }]}>
                  <Ionicons name="finger-print" size={20} color="#3B82F6" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>Face ID / Touch ID</Text>
                  <Text style={styles.menuSubtitle}>
                    Quick & secure login
                  </Text>
                </View>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={setBiometricsEnabled}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          {/* Security Alerts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security Alerts</Text>
            <View style={styles.card}>
              <View style={[styles.toggleItem, styles.borderBottom]}>
                <View style={[styles.menuIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="log-in-outline" size={20} color="#D97706" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>Login Alerts</Text>
                  <Text style={styles.menuSubtitle}>
                    Get notified of new logins
                  </Text>
                </View>
                <Switch
                  value={loginAlerts}
                  onValueChange={setLoginAlerts}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.toggleItem}>
                <View style={[styles.menuIcon, { backgroundColor: "#FEE2E2" }]}>
                  <Ionicons name="card-outline" size={20} color="#DC2626" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>Transaction Alerts</Text>
                  <Text style={styles.menuSubtitle}>
                    Alerts for money movement
                  </Text>
                </View>
                <Switch
                  value={transactionAlerts}
                  onValueChange={setTransactionAlerts}
                  trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          {/* Active Sessions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sessions</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate("ActiveSessions" as any)}
              >
                <View style={[styles.menuIcon, { backgroundColor: "#F5F7FA" }]}>
                  <Ionicons name="phone-portrait-outline" size={20} color="#0A2342" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>Active Sessions</Text>
                  <Text style={styles.menuSubtitle}>3 devices logged in</Text>
                </View>
                <View style={styles.sessionsBadge}>
                  <Text style={styles.sessionsBadgeText}>3</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Security Tips */}
          <View style={styles.tipCard}>
            <Ionicons name="bulb-outline" size={20} color="#00897B" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Security Tips</Text>
              <Text style={styles.tipText}>
                Enable all security features and use a strong, unique password to keep your account safe.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
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
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 16,
    gap: 16,
  },
  scoreCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  scoreMax: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
  },
  scoreInfo: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  scoreStatus: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  toggleItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  menuSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  enabledBadge: {
    backgroundColor: "#F0FDFB",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  enabledText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#00C6AE",
  },
  sessionsBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0A2342",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionsBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00897B",
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: "#065F46",
    lineHeight: 18,
  },
});
