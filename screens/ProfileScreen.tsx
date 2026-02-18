import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useXnScore } from "../context/XnScoreContext";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, signOut } = useAuth();
  const { score, level } = useXnScore();

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await signOut();
            navigation.reset({
              index: 0,
              routes: [{ name: "Splash" }],
            });
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      section: "Account",
      items: [
        { icon: "person-outline", label: "Personal Information", onPress: () => navigation.navigate("PersonalInfo") },
        { icon: "shield-checkmark-outline", label: "Security", onPress: () => navigation.navigate("SecuritySettings") },
        { icon: "card-outline", label: "Payment Methods", onPress: () => navigation.navigate("LinkedAccounts") },
        { icon: "notifications-outline", label: "Notifications", onPress: () => navigation.navigate("NotificationPrefs") },
      ],
    },
    {
      section: "Trust & Honor",
      items: [
        { icon: "ribbon-outline", label: "Honor System", onPress: () => navigation.navigate("HonorSystem") },
        { icon: "hand-right-outline", label: "Vouch for Members", onPress: () => navigation.navigate("VouchMember") },
      ],
    },
    {
      section: "Preferences",
      items: [
        { icon: "globe-outline", label: "Language & Region", onPress: () => navigation.navigate("LanguageRegion") },
        { icon: "eye-off-outline", label: "Privacy", onPress: () => navigation.navigate("PrivacySettings") },
        { icon: "cog-outline", label: "All Settings", onPress: () => navigation.navigate("Settings") },
      ],
    },
    {
      section: "Support",
      items: [
        { icon: "help-circle-outline", label: "Help Center", onPress: () => navigation.navigate("HelpCenter") },
        { icon: "information-circle-outline", label: "About TandaXn", onPress: () => navigation.navigate("AboutApp") },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={["#00C6AE", "#00A896"]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {(user?.name || "U").charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
              <TouchableOpacity style={styles.editAvatarButton}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>{user?.name || "User"}</Text>
            <Text style={styles.userEmail}>{user?.email || ""}</Text>

            {/* XnScore Badge */}
            <TouchableOpacity
              style={styles.xnScoreContainer}
              onPress={() => navigation.navigate("XnScoreDashboard")}
            >
              <View style={styles.xnScoreBadge}>
                <Ionicons
                  name={level.icon as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={level.color}
                />
                <Text style={styles.xnScoreValue}>{score}</Text>
                <Text style={styles.xnScoreLabel}>XnScore™</Text>
              </View>
              <View style={styles.improveButton}>
                <Text style={styles.improveButtonText}>View Details</Text>
                <Ionicons name="chevron-forward" size={14} color="#00C6AE" />
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Menu Sections */}
        <View style={styles.content}>
          {menuItems.map((section, sectionIdx) => (
            <View key={sectionIdx} style={styles.menuSection}>
              <Text style={styles.sectionTitle}>{section.section}</Text>
              <View style={styles.menuCard}>
                {section.items.map((item, itemIdx) => (
                  <TouchableOpacity
                    key={itemIdx}
                    style={[
                      styles.menuItem,
                      itemIdx < section.items.length - 1 ? styles.menuItemBorder : null,
                    ]}
                    onPress={item.onPress}
                  >
                    <View style={styles.menuItemLeft}>
                      <View style={styles.menuIconContainer}>
                        <Ionicons name={item.icon as any} size={20} color="#0A2342" />
                      </View>
                      <Text style={styles.menuItemLabel}>{item.label}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Sign Out Button */}
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          {/* App Version */}
          <Text style={styles.versionText}>TandaXn v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.floatingHelp}
        onPress={() => navigation.navigate("HelpCenter" as any)}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        <Text style={styles.floatingHelpText}>Help</Text>
      </TouchableOpacity>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 20,
  },
  profileCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0A2342",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 20,
  },
  xnScoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  xnScoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,198,174,0.2)",
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.4)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  xnScoreValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#00C6AE",
  },
  xnScoreLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  improveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  improveButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C6AE",
  },
  content: {
    padding: 20,
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#0A2342",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DC2626",
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 20,
  },
  floatingHelp: {
    position: "absolute",
    bottom: 90,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00C6AE",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingHelpText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
