import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type AboutAppNavigationProp = StackNavigationProp<RootStackParamList>;

export default function AboutAppScreen() {
  const navigation = useNavigation<AboutAppNavigationProp>();

  const appInfo = {
    version: "2.5.0",
    build: "250115",
    lastUpdated: "January 2025",
  };

  const handleRateApp = () => {
    // In a real app, this would open the App Store/Play Store
    Linking.openURL("https://apps.apple.com/app/tandaxn");
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message:
          "Check out TandaXn - the best way to save money with friends and family! Download now: https://tandaxn.com/download",
        title: "Share TandaXn",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleTermsOfService = () => {
    Linking.openURL("https://tandaxn.com/terms");
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL("https://tandaxn.com/privacy");
  };

  const handleLicenses = () => {
    console.log("Open licenses");
  };

  const handleWebsite = () => {
    Linking.openURL("https://tandaxn.com");
  };

  const handleTwitter = () => {
    Linking.openURL("https://twitter.com/tandaxn");
  };

  const handleInstagram = () => {
    Linking.openURL("https://instagram.com/tandaxn");
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={["#0A2342", "#143654"]}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>About TandaXn</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Xn</Text>
            </View>
            <Text style={styles.appName}>TandaXn</Text>
            <Text style={styles.tagline}>Dream it! Save it! Achieve!</Text>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Version Card */}
          <View style={styles.versionCard}>
            <Text style={styles.versionLabel}>Version</Text>
            <Text style={styles.versionNumber}>{appInfo.version}</Text>
            <Text style={styles.versionMeta}>
              Build {appInfo.build} • Updated {appInfo.lastUpdated}
            </Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.card}>
            <TouchableOpacity style={styles.actionItem} onPress={handleRateApp}>
              <View style={[styles.actionIcon, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="star" size={22} color="#D97706" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Rate TandaXn</Text>
                <Text style={styles.actionSubtitle}>
                  Leave a review on the App Store
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.actionItem} onPress={handleShareApp}>
              <View style={[styles.actionIcon, { backgroundColor: "#F0FDFB" }]}>
                <Ionicons name="share-social" size={22} color="#00C6AE" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Share TandaXn</Text>
                <Text style={styles.actionSubtitle}>
                  Invite friends to save together
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Legal */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Legal</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.linkItem}
                onPress={handleTermsOfService}
              >
                <Text style={styles.linkText}>Terms of Service</Text>
                <Ionicons name="open-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.linkItem}
                onPress={handlePrivacyPolicy}
              >
                <Text style={styles.linkText}>Privacy Policy</Text>
                <Ionicons name="open-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity style={styles.linkItem} onPress={handleLicenses}>
                <Text style={styles.linkText}>Open Source Licenses</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Social Links */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Follow Us</Text>
            <View style={styles.socialButtons}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleWebsite}
              >
                <Ionicons name="globe-outline" size={22} color="#0A2342" />
                <Text style={styles.socialButtonText}>Website</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleTwitter}
              >
                <Ionicons name="logo-twitter" size={22} color="#1DA1F2" />
                <Text style={styles.socialButtonText}>Twitter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleInstagram}
              >
                <Ionicons name="logo-instagram" size={22} color="#E4405F" />
                <Text style={styles.socialButtonText}>Instagram</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Company Info */}
          <View style={styles.companyCard}>
            <Text style={styles.companyName}>TandaXn, LLC</Text>
            <Text style={styles.companyLocation}>Delaware, USA</Text>
            <Text style={styles.companyDisclaimer}>
              TandaXn is not a bank. Funds are safeguarded with licensed partners.
              Investment products carry risk. See Terms for details.
            </Text>
          </View>

          {/* Copyright */}
          <Text style={styles.copyright}>
            © 2024-2025 TandaXn, LLC. All rights reserved.
          </Text>
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
    paddingBottom: 30,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
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
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  logoSection: {
    alignItems: "center",
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#00C6AE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#00C6AE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  logoText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  appName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  content: {
    padding: 20,
    marginTop: -10,
    paddingBottom: 40,
  },
  versionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  versionLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  versionNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  versionMeta: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    marginBottom: 16,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  actionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#F5F7FA",
  },
  section: {
    marginBottom: 16,
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
  linkItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  linkText: {
    fontSize: 14,
    color: "#0A2342",
  },
  socialButtons: {
    flexDirection: "row",
    gap: 10,
  },
  socialButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  socialButtonText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#0A2342",
  },
  companyCard: {
    backgroundColor: "#0A2342",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  companyLocation: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 12,
  },
  companyDisclaimer: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 16,
  },
  copyright: {
    textAlign: "center",
    fontSize: 11,
    color: "#9CA3AF",
  },
});
