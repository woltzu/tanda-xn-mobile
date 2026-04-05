import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useNearYou, NearYouProfile } from "../hooks/useCommunityFeatures";

interface Props {
  city: string;
}

export default function NearYouScreen({ city }: Props) {
  const navigation = useNavigation();
  const { profiles, pendingConnections, loading, sayHello, respondToConnection, toggleDiscoverable, refresh } = useNearYou(city);
  const [radius, setRadius] = useState(10);
  const [helloTarget, setHelloTarget] = useState<string | null>(null);
  const [helloMessage, setHelloMessage] = useState("");
  const [sentHellos, setSentHellos] = useState<Set<string>>(new Set());
  const [isDiscoverable, setIsDiscoverable] = useState(true);

  const filteredProfiles = profiles; // Could filter by radius later with lat/lng

  const handleSayHello = useCallback(async (profile: NearYouProfile) => {
    try {
      await sayHello(profile.userId, helloMessage || `Hi ${profile.firstName}! I noticed we're both in ${city}. Would love to connect.`);
      setSentHellos(prev => new Set(prev).add(profile.userId));
      setHelloTarget(null);
      setHelloMessage("");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not send message");
    }
  }, [sayHello, helloMessage, city]);

  const handleToggleDiscoverable = (value: boolean) => {
    setIsDiscoverable(value);
    toggleDiscoverable(value);
  };

  const getSharedContext = (profile: NearYouProfile): string => {
    if (profile.sharedCircles?.length) return `Also in ${profile.sharedCircles[0]}`;
    if (profile.sharedCommunities?.length) return `${profile.sharedCommunities[0]} member`;
    if (profile.originCountry) return `From ${profile.originCountry}`;
    return "Nearby neighbor";
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Near You</Text>
          <View style={styles.placeholder} />
        </View>
        <Text style={styles.headerSubtitle}>{city}</Text>

        {/* Radius Selector */}
        <View style={styles.radiusBar}>
          <TouchableOpacity
            style={[styles.radiusBtn, radius === 5 && styles.radiusBtnActive]}
            onPress={() => setRadius(5)}
          >
            <Text style={[styles.radiusBtnText, radius === 5 && styles.radiusBtnTextActive]}>5 mi</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.radiusBtn, radius === 10 && styles.radiusBtnActive]}
            onPress={() => setRadius(10)}
          >
            <Text style={[styles.radiusBtnText, radius === 10 && styles.radiusBtnTextActive]}>10 mi</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.radiusBtn, radius === 25 && styles.radiusBtnActive]}
            onPress={() => setRadius(25)}
          >
            <Text style={[styles.radiusBtnText, radius === 25 && styles.radiusBtnTextActive]}>25 mi</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {/* Pending Connections */}
        {pendingConnections.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connection Requests</Text>
            {pendingConnections.map((conn) => (
              <View key={conn.id} style={styles.connectionCard}>
                <Text style={styles.connMessage}>{conn.message}</Text>
                <View style={styles.connActions}>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => respondToConnection(conn.id, "accepted")}
                  >
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.ignoreBtn}
                    onPress={() => respondToConnection(conn.id, "ignored")}
                  >
                    <Text style={styles.ignoreBtnText}>Ignore</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* People Near You */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>People Near You</Text>
          {filteredProfiles.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="location-outline" size={56} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No one nearby yet</Text>
              <Text style={styles.emptySubtitle}>Members in {city} will appear here</Text>
            </View>
          )}
          {filteredProfiles.map((profile) => {
            const isSent = sentHellos.has(profile.userId);
            const isTarget = helloTarget === profile.userId;

            return (
              <View key={profile.id} style={styles.profileCard}>
                <View style={styles.profileTop}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>
                      {profile.originCountryFlag || profile.firstName.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{profile.firstName}</Text>
                    <Text style={styles.profileOrigin}>
                      {profile.originCity ? `From ${profile.originCity}` : profile.originCountry}
                    </Text>
                    <View style={styles.sharedContext}>
                      <Ionicons name="link-outline" size={12} color="#00C6AE" />
                      <Text style={styles.sharedContextText}>{getSharedContext(profile)}</Text>
                    </View>
                  </View>
                  <Text style={styles.neighborhoodLabel}>{profile.neighborhood}</Text>
                </View>

                {!isTarget && (
                  <TouchableOpacity
                    style={[styles.helloButton, isSent && styles.helloButtonSent]}
                    onPress={() => { setHelloTarget(profile.userId); setHelloMessage(""); }}
                    disabled={isSent}
                  >
                    <Ionicons name={isSent ? "checkmark" : "hand-right-outline"} size={16} color={isSent ? "#10B981" : "#FFFFFF"} />
                    <Text style={[styles.helloButtonText, isSent && styles.helloButtonTextSent]}>
                      {isSent ? "Sent" : "Say hello"}
                    </Text>
                  </TouchableOpacity>
                )}

                {isTarget && (
                  <View style={styles.helloEditor}>
                    <TextInput
                      style={styles.helloInput}
                      placeholder={`Hi ${profile.firstName}! I noticed we're both in ${city}...`}
                      placeholderTextColor="#9CA3AF"
                      value={helloMessage}
                      onChangeText={setHelloMessage}
                      multiline
                      maxLength={300}
                    />
                    <View style={styles.helloActions}>
                      <TouchableOpacity onPress={() => setHelloTarget(null)}>
                        <Text style={styles.helloCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.helloSendBtn} onPress={() => handleSayHello(profile)}>
                        <Ionicons name="send" size={14} color="#FFFFFF" />
                        <Text style={styles.helloSendText}>Send</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyCard}>
          <View style={styles.privacyHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#6B7280" />
            <Text style={styles.privacyTitle}>Your Privacy</Text>
          </View>
          <Text style={styles.privacyText}>
            Your neighborhood is set manually — we never track your GPS location. Only your first name and origin are shown.
          </Text>
          <View style={styles.privacyToggle}>
            <Text style={styles.privacyToggleLabel}>Appear in Near You</Text>
            <Switch value={isDiscoverable} onValueChange={handleToggleDiscoverable} trackColor={{ true: "#00C6AE" }} />
          </View>
        </View>

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
  radiusBar: { flexDirection: "row", gap: 8, justifyContent: "center" },
  radiusBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)" },
  radiusBtnActive: { backgroundColor: "#00C6AE" },
  radiusBtnText: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
  radiusBtnTextActive: { color: "#FFFFFF" },
  content: { flex: 1, padding: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342", marginBottom: 12 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342", marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  connectionCard: { backgroundColor: "#FFF7ED", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#FED7AA" },
  connMessage: { fontSize: 14, color: "#0A2342", marginBottom: 10 },
  connActions: { flexDirection: "row", gap: 10 },
  acceptBtn: { flex: 1, backgroundColor: "#00C6AE", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  acceptBtnText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  ignoreBtn: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  ignoreBtnText: { fontSize: 14, fontWeight: "500", color: "#6B7280" },
  profileCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  profileTop: { flexDirection: "row", alignItems: "center" },
  profileAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#F0FDFB", alignItems: "center", justifyContent: "center", marginRight: 14 },
  profileAvatarText: { fontSize: 24 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: "600", color: "#0A2342", marginBottom: 2 },
  profileOrigin: { fontSize: 13, color: "#6B7280", marginBottom: 4 },
  sharedContext: { flexDirection: "row", alignItems: "center", gap: 4 },
  sharedContextText: { fontSize: 12, color: "#00C6AE", fontWeight: "500" },
  neighborhoodLabel: { fontSize: 12, color: "#9CA3AF", backgroundColor: "#F5F7FA", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  helloButton: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#0A2342", borderRadius: 12, paddingVertical: 12 },
  helloButtonSent: { backgroundColor: "#F0FDF4" },
  helloButtonText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  helloButtonTextSent: { color: "#10B981" },
  helloEditor: { marginTop: 12, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 12 },
  helloInput: { fontSize: 14, color: "#0A2342", minHeight: 60, textAlignVertical: "top" },
  helloActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  helloCancelText: { fontSize: 14, color: "#6B7280", paddingVertical: 8 },
  helloSendBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0A2342", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  helloSendText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  privacyCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  privacyHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  privacyTitle: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  privacyText: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginBottom: 12 },
  privacyToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  privacyToggleLabel: { fontSize: 14, fontWeight: "500", color: "#0A2342" },
});
