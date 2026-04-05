import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useArrivals, CommunityArrival } from "../hooks/useCommunityFeatures";

interface Props {
  communityId: string;
  communityName?: string;
}

export default function NewArrivalsScreen({ communityId, communityName = "My Community" }: Props) {
  const navigation = useNavigation();
  const { arrivals, stats, loading, sendWelcome, refresh } = useArrivals(communityId);
  const [welcomingId, setWelcomingId] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [sentWelcomes, setSentWelcomes] = useState<Set<string>>(new Set());

  const defaultMessage = (name: string, origin: string) =>
    `Welcome to the community! I am also ${origin}. If you need anything as you get settled, feel free to reach out.`;

  const handleWelcomeTap = (arrival: CommunityArrival) => {
    if (sentWelcomes.has(arrival.id)) return;
    setWelcomingId(arrival.id);
    setWelcomeMessage(defaultMessage(arrival.firstName, arrival.originCountry ?? "from the diaspora"));
  };

  const handleSendWelcome = useCallback(async (arrival: CommunityArrival) => {
    try {
      await sendWelcome(arrival.id, arrival.userId, welcomeMessage);
      setSentWelcomes(prev => new Set(prev).add(arrival.id));
      setWelcomingId(null);
      setWelcomeMessage("");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not send welcome");
    }
  }, [sendWelcome, welcomeMessage]);

  const getDaysSince = (dateStr: string) => {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    return days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Arrivals</Text>
          <View style={styles.placeholder} />
        </View>
        <Text style={styles.headerSubtitle}>{communityName}</Text>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.thisWeek}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.thisMonth}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {arrivals.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No new arrivals yet</Text>
            <Text style={styles.emptySubtitle}>New members will appear here when they join</Text>
          </View>
        )}

        {arrivals.map((arrival) => {
          const isSent = sentWelcomes.has(arrival.id);
          const isWelcoming = welcomingId === arrival.id;

          return (
            <View key={arrival.id} style={styles.arrivalCard}>
              <View style={styles.arrivalTop}>
                <View style={styles.arrivalAvatar}>
                  <Text style={styles.arrivalAvatarText}>
                    {arrival.originCountryFlag || arrival.firstName.charAt(0)}
                  </Text>
                </View>
                <View style={styles.arrivalInfo}>
                  <Text style={styles.arrivalName}>{arrival.firstName}</Text>
                  <Text style={styles.arrivalOrigin}>
                    {arrival.originCity ? `From ${arrival.originCity}, ${arrival.originCountry}` : arrival.originCountry}
                  </Text>
                  <View style={styles.arrivalMeta}>
                    <Ionicons name="location-outline" size={12} color="#6B7280" />
                    <Text style={styles.arrivalLocation}>
                      {arrival.currentNeighborhood ?? arrival.currentCity ?? "Nearby"}
                    </Text>
                    <Text style={styles.arrivalDot}> . </Text>
                    <Text style={styles.arrivalDate}>{getDaysSince(arrival.createdAt)}</Text>
                  </View>
                </View>
                {arrival.welcomedCount > 0 && (
                  <View style={styles.welcomedBadge}>
                    <Ionicons name="heart" size={12} color="#00C6AE" />
                    <Text style={styles.welcomedCount}>{arrival.welcomedCount}</Text>
                  </View>
                )}
              </View>

              {/* Welcome / Sent button */}
              {!isWelcoming && (
                <TouchableOpacity
                  style={[styles.welcomeButton, isSent && styles.welcomeButtonSent]}
                  onPress={() => handleWelcomeTap(arrival)}
                  disabled={isSent}
                >
                  <Ionicons
                    name={isSent ? "checkmark-circle" : "hand-right-outline"}
                    size={16}
                    color={isSent ? "#10B981" : "#FFFFFF"}
                  />
                  <Text style={[styles.welcomeButtonText, isSent && styles.welcomeButtonTextSent]}>
                    {isSent ? "Sent" : "Welcome"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Editable welcome message */}
              {isWelcoming && (
                <View style={styles.welcomeEditor}>
                  <TextInput
                    style={styles.welcomeInput}
                    value={welcomeMessage}
                    onChangeText={setWelcomeMessage}
                    multiline
                    maxLength={300}
                    placeholder="Write a welcome message..."
                    placeholderTextColor="#9CA3AF"
                  />
                  <View style={styles.welcomeActions}>
                    <TouchableOpacity
                      style={styles.welcomeCancel}
                      onPress={() => setWelcomingId(null)}
                    >
                      <Text style={styles.welcomeCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.welcomeSend}
                      onPress={() => handleSendWelcome(arrival)}
                    >
                      <Ionicons name="send" size={14} color="#FFFFFF" />
                      <Text style={styles.welcomeSendText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  placeholder: { width: 40 },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.7)", textAlign: "center", marginBottom: 16 },
  statsBar: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, alignItems: "center", justifyContent: "space-around" },
  statItem: { alignItems: "center" },
  statNumber: { fontSize: 24, fontWeight: "700", color: "#FFFFFF" },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },
  content: { flex: 1, padding: 20 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342", marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  arrivalCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  arrivalTop: { flexDirection: "row", alignItems: "center" },
  arrivalAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#F0FDFB", alignItems: "center", justifyContent: "center", marginRight: 14 },
  arrivalAvatarText: { fontSize: 24 },
  arrivalInfo: { flex: 1 },
  arrivalName: { fontSize: 16, fontWeight: "600", color: "#0A2342", marginBottom: 2 },
  arrivalOrigin: { fontSize: 13, color: "#6B7280", marginBottom: 4 },
  arrivalMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  arrivalLocation: { fontSize: 12, color: "#6B7280" },
  arrivalDot: { fontSize: 12, color: "#D1D5DB" },
  arrivalDate: { fontSize: 12, color: "#9CA3AF" },
  welcomedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F0FDFB", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
  welcomedCount: { fontSize: 12, fontWeight: "600", color: "#00C6AE" },
  welcomeButton: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#00C6AE", borderRadius: 12, paddingVertical: 12 },
  welcomeButtonSent: { backgroundColor: "#F0FDF4" },
  welcomeButtonText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  welcomeButtonTextSent: { color: "#10B981" },
  welcomeEditor: { marginTop: 12, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 12 },
  welcomeInput: { fontSize: 14, color: "#0A2342", minHeight: 60, textAlignVertical: "top" },
  welcomeActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  welcomeCancel: { paddingVertical: 8, paddingHorizontal: 16 },
  welcomeCancelText: { fontSize: 14, color: "#6B7280" },
  welcomeSend: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#00C6AE", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  welcomeSendText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
});
