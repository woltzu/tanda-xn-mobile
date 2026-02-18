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

type TwoFactorAuthNavigationProp = StackNavigationProp<RootStackParamList>;

interface TwoFAMethod {
  id: string;
  icon: string;
  title: string;
  description: string;
  recommended?: boolean;
}

export default function TwoFactorAuthScreen() {
  const navigation = useNavigation<TwoFactorAuthNavigationProp>();

  const [enabled, setEnabled] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState("authenticator");
  const backupCodesRemaining = 8;

  const methods: TwoFAMethod[] = [
    {
      id: "authenticator",
      icon: "key",
      title: "Authenticator App",
      description: "Google Authenticator, Authy, etc.",
      recommended: true,
    },
    {
      id: "sms",
      icon: "chatbox-ellipses",
      title: "SMS Code",
      description: "+1 (***) ***-4567",
    },
    {
      id: "email",
      icon: "mail",
      title: "Email Code",
      description: "f***@gmail.com",
    },
  ];

  const handleToggle2FA = (value: boolean) => {
    if (!value) {
      Alert.alert(
        "Disable 2FA",
        "Are you sure you want to disable two-factor authentication? This will make your account less secure.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: () => setEnabled(false),
          },
        ]
      );
    } else {
      setEnabled(true);
    }
  };

  const handleViewBackupCodes = () => {
    Alert.alert(
      "View Backup Codes",
      "For security, you'll need to verify your identity to view your backup codes.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Verify", onPress: () => console.log("Show backup codes") },
      ]
    );
  };

  const handleRegenerateBackupCodes = () => {
    Alert.alert(
      "Regenerate Backup Codes",
      "This will invalidate your existing backup codes. Are you sure you want to continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          onPress: () => console.log("Regenerate backup codes"),
        },
      ]
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
              <Text style={styles.headerTitle}>Two-Factor Authentication</Text>
              <Text style={styles.headerSubtitle}>Extra security for your account</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Main Toggle */}
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View
                style={[
                  styles.toggleIcon,
                  { backgroundColor: enabled ? "#F0FDFB" : "#F5F7FA" },
                ]}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={26}
                  color={enabled ? "#00C6AE" : "#6B7280"}
                />
              </View>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleTitle}>Two-Factor Authentication</Text>
                <Text style={styles.toggleSubtitle}>
                  {enabled ? "Your account is protected" : "Add extra security"}
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={handleToggle2FA}
                trackColor={{ false: "#E5E7EB", true: "#00C6AE" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {enabled && (
            <>
              {/* Method Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Verification Method</Text>
                <View style={styles.card}>
                  {methods.map((method, index) => (
                    <TouchableOpacity
                      key={method.id}
                      style={[
                        styles.methodItem,
                        index < methods.length - 1 && styles.methodItemBorder,
                        selectedMethod === method.id && styles.methodItemSelected,
                      ]}
                      onPress={() => setSelectedMethod(method.id)}
                    >
                      <View
                        style={[
                          styles.methodIcon,
                          {
                            backgroundColor:
                              selectedMethod === method.id
                                ? "#F0FDFB"
                                : "#F5F7FA",
                          },
                        ]}
                      >
                        <Ionicons
                          name={method.icon as any}
                          size={22}
                          color={
                            selectedMethod === method.id ? "#00C6AE" : "#6B7280"
                          }
                        />
                      </View>
                      <View style={styles.methodContent}>
                        <View style={styles.methodTitleRow}>
                          <Text style={styles.methodTitle}>{method.title}</Text>
                          {method.recommended && (
                            <View style={styles.recommendedBadge}>
                              <Text style={styles.recommendedText}>RECOMMENDED</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.methodDescription}>
                          {method.description}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.radioCircle,
                          selectedMethod === method.id && styles.radioCircleSelected,
                        ]}
                      >
                        {selectedMethod === method.id && (
                          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Backup Codes */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Backup Codes</Text>
                <View style={styles.card}>
                  <View style={styles.backupHeader}>
                    <Text style={styles.backupTitle}>Recovery Codes</Text>
                    <View
                      style={[
                        styles.backupBadge,
                        {
                          backgroundColor:
                            backupCodesRemaining > 3 ? "#F0FDFB" : "#FEF3C7",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.backupBadgeText,
                          {
                            color:
                              backupCodesRemaining > 3 ? "#00897B" : "#D97706",
                          },
                        ]}
                      >
                        {backupCodesRemaining} remaining
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.backupDescription}>
                    Use backup codes to access your account if you lose access to
                    your phone.
                  </Text>
                  <View style={styles.backupButtons}>
                    <TouchableOpacity
                      style={styles.backupButton}
                      onPress={handleViewBackupCodes}
                    >
                      <Text style={styles.backupButtonText}>View Codes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.backupButtonOutline}
                      onPress={handleRegenerateBackupCodes}
                    >
                      <Text style={styles.backupButtonOutlineText}>Regenerate</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Info Note */}
          <View
            style={[
              styles.infoCard,
              { backgroundColor: enabled ? "#F0FDFB" : "#FEF3C7" },
            ]}
          >
            <Ionicons
              name={enabled ? "shield-checkmark" : "warning"}
              size={18}
              color={enabled ? "#00897B" : "#D97706"}
            />
            <Text
              style={[
                styles.infoText,
                { color: enabled ? "#065F46" : "#92400E" },
              ]}
            >
              {enabled
                ? "Two-factor authentication adds an extra layer of security. You'll need to enter a code each time you sign in."
                : "Your account is not fully protected. We strongly recommend enabling two-factor authentication."}
            </Text>
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
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  toggleIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleContent: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
  },
  toggleSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  section: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  methodItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  methodItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FA",
  },
  methodItemSelected: {
    backgroundColor: "#F0FDFB",
    marginHorizontal: -16,
    paddingHorizontal: 30,
    borderRadius: 0,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  methodContent: {
    flex: 1,
  },
  methodTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  recommendedBadge: {
    backgroundColor: "#00C6AE",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  recommendedText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  methodDescription: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    backgroundColor: "#00C6AE",
    borderColor: "#00C6AE",
  },
  backupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  backupTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
  backupBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  backupBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  backupDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 12,
  },
  backupButtons: {
    flexDirection: "row",
    gap: 10,
  },
  backupButton: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  backupButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A2342",
  },
  backupButtonOutline: {
    flex: 1,
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#00C6AE",
    paddingVertical: 12,
    alignItems: "center",
  },
  backupButtonOutlineText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00897B",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
