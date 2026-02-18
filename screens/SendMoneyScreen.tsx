import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";

type SendMoneyNavigationProp = StackNavigationProp<RootStackParamList>;

export default function SendMoneyScreen() {
  const navigation = useNavigation<SendMoneyNavigationProp>();
  const [sendType, setSendType] = useState<"domestic" | "international" | null>(null);

  const handleSelectDestination = (type: "domestic" | "international") => {
    setSendType(type);
    if (type === "international") {
      navigation.navigate("Remittance");
    } else {
      navigation.navigate("DomesticSendMoney");
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
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Send Money</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Destination Type Selection */}
          <View style={styles.destinationContainer}>
            <Text style={styles.destinationTitle}>Where are you sending?</Text>
            <Text style={styles.destinationSubtitle}>
              Choose your transfer destination
            </Text>

            <TouchableOpacity
              style={[
                styles.destinationCard,
                sendType === "domestic" && styles.destinationCardSelected,
              ]}
              onPress={() => handleSelectDestination("domestic")}
            >
              <View style={[styles.destinationIcon, { backgroundColor: "#F0FDFB" }]}>
                <Ionicons name="home-outline" size={28} color="#00C6AE" />
              </View>
              <View style={styles.destinationInfo}>
                <Text style={styles.destinationLabel}>Domestic</Text>
                <Text style={styles.destinationDesc}>
                  Send within the United States
                </Text>
              </View>
              <View style={styles.destinationArrow}>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.destinationCard,
                sendType === "international" && styles.destinationCardSelected,
              ]}
              onPress={() => handleSelectDestination("international")}
            >
              <View style={[styles.destinationIcon, { backgroundColor: "#EEF2FF" }]}>
                <Ionicons name="globe-outline" size={28} color="#6366F1" />
              </View>
              <View style={styles.destinationInfo}>
                <Text style={styles.destinationLabel}>International</Text>
                <Text style={styles.destinationDesc}>
                  Send abroad to family & friends
                </Text>
              </View>
              <View style={styles.destinationArrow}>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
              <Text style={styles.infoText}>
                International transfers may include exchange rates and additional fees
              </Text>
            </View>
          </View>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
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
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  progressDotActive: {
    backgroundColor: "#00C6AE",
  },
  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginHorizontal: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  destinationContainer: {
    paddingTop: 20,
  },
  destinationTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 8,
  },
  destinationSubtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginBottom: 24,
  },
  destinationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  destinationCardSelected: {
    borderColor: "#00C6AE",
    backgroundColor: "#F0FDFB",
  },
  destinationIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  destinationInfo: {
    flex: 1,
  },
  destinationLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0A2342",
    marginBottom: 4,
  },
  destinationDesc: {
    fontSize: 14,
    color: "#6B7280",
  },
  destinationArrow: {
    marginLeft: 8,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
});
