import React, { useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type ActiveSessionsNavigationProp = StackNavigationProp<RootStackParamList>;

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  deviceType: "mobile" | "desktop" | "tablet";
}

export default function ActiveSessionsScreen() {
  const navigation = useNavigation<ActiveSessionsNavigationProp>();

  const [sessions] = useState<Session[]>([
    {
      id: "s1",
      device: "iPhone 14 Pro",
      browser: "TandaXn App",
      location: "Atlanta, GA",
      lastActive: "Now",
      isCurrent: true,
      deviceType: "mobile",
    },
    {
      id: "s2",
      device: "MacBook Pro",
      browser: "Chrome",
      location: "Atlanta, GA",
      lastActive: "2 hours ago",
      isCurrent: false,
      deviceType: "desktop",
    },
    {
      id: "s3",
      device: "iPad Air",
      browser: "TandaXn App",
      location: "New York, NY",
      lastActive: "3 days ago",
      isCurrent: false,
      deviceType: "tablet",
    },
  ]);

  const getDeviceIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case "mobile":
        return "phone-portrait";
      case "desktop":
        return "desktop";
      case "tablet":
        return "tablet-portrait";
      default:
        return "hardware-chip";
    }
  };

  const handleLogoutSession = (session: Session) => {
    Alert.alert(
      "Log Out Session",
      `Are you sure you want to log out from ${session.device}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: () => console.log("Log out session:", session.id),
        },
      ]
    );
  };

  const handleLogoutAll = () => {
    Alert.alert(
      "Log Out All Sessions",
      "This will log you out from all other devices. You'll stay logged in on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out All",
          style: "destructive",
          onPress: () => console.log("Log out all other sessions"),
        },
      ]
    );
  };

  const currentSession = sessions.find((s) => s.isCurrent);
  const otherSessions = sessions.filter((s) => !s.isCurrent);

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
              <Text style={styles.headerTitle}>Active Sessions</Text>
              <Text style={styles.headerSubtitle}>
                {sessions.length} device{sessions.length !== 1 ? "s" : ""} logged in
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Current Session */}
          {currentSession && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>This Device</Text>
              <View style={styles.currentSessionCard}>
                <View style={styles.sessionRow}>
                  <View style={styles.currentDeviceIcon}>
                    <Ionicons
                      name={getDeviceIcon(currentSession.deviceType)}
                      size={24}
                      color="#00C6AE"
                    />
                  </View>
                  <View style={styles.sessionContent}>
                    <View style={styles.sessionTitleRow}>
                      <Text style={styles.sessionDevice}>
                        {currentSession.device}
                      </Text>
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>THIS DEVICE</Text>
                      </View>
                    </View>
                    <Text style={styles.sessionBrowser}>
                      {currentSession.browser}
                    </Text>
                    <View style={styles.sessionMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color="#6B7280"
                        />
                        <Text style={styles.metaText}>
                          {currentSession.location}
                        </Text>
                      </View>
                      <Text style={styles.activeNow}>Active now</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Other Sessions */}
          {otherSessions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Other Sessions</Text>
              <View style={styles.card}>
                {otherSessions.map((session, index) => (
                  <View
                    key={session.id}
                    style={[
                      styles.sessionRow,
                      styles.otherSession,
                      index < otherSessions.length - 1 && styles.borderBottom,
                    ]}
                  >
                    <View style={styles.deviceIcon}>
                      <Ionicons
                        name={getDeviceIcon(session.deviceType)}
                        size={22}
                        color="#0A2342"
                      />
                    </View>
                    <View style={styles.sessionContent}>
                      <Text style={styles.sessionDevice}>{session.device}</Text>
                      <Text style={styles.sessionBrowser}>{session.browser}</Text>
                      <View style={styles.sessionMeta}>
                        <View style={styles.metaItem}>
                          <Ionicons
                            name="location-outline"
                            size={12}
                            color="#6B7280"
                          />
                          <Text style={styles.metaText}>{session.location}</Text>
                        </View>
                        <Text style={styles.metaText}>
                          {session.lastActive}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.logoutButton}
                      onPress={() => handleLogoutSession(session)}
                    >
                      <Text style={styles.logoutButtonText}>Log Out</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Security Warning */}
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={18} color="#D97706" />
            <Text style={styles.warningText}>
              Don't recognize a session? Log it out immediately and change your
              password to secure your account.
            </Text>
          </View>

          {/* Security Tips */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Security Tips</Text>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color="#00C6AE" />
              <Text style={styles.tipText}>
                Regularly review your active sessions
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color="#00C6AE" />
              <Text style={styles.tipText}>
                Log out from devices you no longer use
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color="#00C6AE" />
              <Text style={styles.tipText}>
                Enable two-factor authentication
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      {otherSessions.length > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.logoutAllButton}
            onPress={handleLogoutAll}
          >
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            <Text style={styles.logoutAllText}>Log Out All Other Sessions</Text>
          </TouchableOpacity>
        </View>
      )}
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
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 10,
  },
  currentSessionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#00C6AE",
    overflow: "hidden",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    gap: 14,
  },
  otherSession: {
    alignItems: "center",
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  currentDeviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionContent: {
    flex: 1,
  },
  sessionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  sessionDevice: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A2342",
  },
  currentBadge: {
    backgroundColor: "#00C6AE",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sessionBrowser: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 6,
  },
  sessionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#6B7280",
  },
  activeNow: {
    fontSize: 11,
    fontWeight: "600",
    color: "#00C6AE",
  },
  logoutButton: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
  tipsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: "#4B5563",
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
  logoutAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DC2626",
    paddingVertical: 16,
    gap: 8,
  },
  logoutAllText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DC2626",
  },
});
