import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useGatherings, GatheringType } from "../hooks/useCommunityFeatures";

const EVENT_TYPES: { key: GatheringType; icon: string; color: string; label: string; desc: string }[] = [
  { key: "community", icon: "people", color: "#00C6AE", label: "Community Event", desc: "Open to all members" },
  { key: "circle", icon: "sync-circle", color: "#6366F1", label: "Circle Gathering", desc: "Circle members only" },
  { key: "elder_session", icon: "school", color: "#F59E0B", label: "Elder Session", desc: "Advice & mentoring" },
  { key: "service", icon: "storefront", color: "#8B5CF6", label: "Service Event", desc: "Provider showcase" },
];

export default function CreateGatheringScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const communityId = (route.params as any)?.communityId ?? "";
  const { user } = useAuth();
  const { createGathering } = useGatherings(communityId);

  const [eventType, setEventType] = useState<GatheringType>("community");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [isVirtual, setIsVirtual] = useState(false);
  const [virtualLink, setVirtualLink] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [isFamilyWelcome, setIsFamilyWelcome] = useState(false);
  const [addToMemory, setAddToMemory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert("Required", "Please enter an event name"); return; }
    if (!dateStr.trim()) { Alert.alert("Required", "Please enter a date"); return; }

    setSubmitting(true);
    try {
      const startsAt = new Date(`${dateStr}T${timeStr || "12:00"}`).toISOString();
      await createGathering({
        communityId,
        title: title.trim(),
        description: description.trim() || undefined,
        eventType,
        locationName: isVirtual ? undefined : locationName.trim() || undefined,
        isVirtual,
        virtualLink: isVirtual ? virtualLink.trim() || undefined : undefined,
        startsAt,
        isFamilyWelcome,
        addToMemory,
        organizerFirstName: user?.user_metadata?.first_name ?? "Member",
        organizerOrigin: user?.user_metadata?.origin_country,
      });
      Alert.alert("Created!", "Your gathering has been posted to the community.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not create gathering");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Gathering</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Event Type Selection */}
          <Text style={styles.sectionLabel}>Event Type</Text>
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeCard, eventType === t.key && { borderColor: t.color, backgroundColor: t.color + "10" }]}
                onPress={() => setEventType(t.key)}
              >
                <View style={[styles.typeIcon, { backgroundColor: t.color + "20" }]}>
                  <Ionicons name={t.icon as any} size={24} color={t.color} />
                </View>
                <Text style={styles.typeLabel}>{t.label}</Text>
                <Text style={styles.typeDesc}>{t.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Event Details */}
          <Text style={styles.sectionLabel}>Event Details</Text>
          <TextInput
            style={styles.input}
            placeholder="Event name"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Description (optional)"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {/* Date & Time */}
          <Text style={styles.sectionLabel}>When</Text>
          <View style={styles.dateRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Date (YYYY-MM-DD)"
              placeholderTextColor="#9CA3AF"
              value={dateStr}
              onChangeText={setDateStr}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Time (HH:MM)"
              placeholderTextColor="#9CA3AF"
              value={timeStr}
              onChangeText={setTimeStr}
            />
          </View>

          {/* Location */}
          <Text style={styles.sectionLabel}>Where</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Virtual event</Text>
            <Switch value={isVirtual} onValueChange={setIsVirtual} trackColor={{ true: "#00C6AE" }} />
          </View>
          {isVirtual ? (
            <TextInput
              style={styles.input}
              placeholder="Meeting link (Zoom, Google Meet, etc.)"
              placeholderTextColor="#9CA3AF"
              value={virtualLink}
              onChangeText={setVirtualLink}
            />
          ) : (
            <TextInput
              style={styles.input}
              placeholder="Location name"
              placeholderTextColor="#9CA3AF"
              value={locationName}
              onChangeText={setLocationName}
            />
          )}

          {/* Options */}
          <Text style={styles.sectionLabel}>Options</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Families welcome</Text>
              <Text style={styles.switchHint}>Let members know they can bring family</Text>
            </View>
            <Switch value={isFamilyWelcome} onValueChange={setIsFamilyWelcome} trackColor={{ true: "#00C6AE" }} />
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Add to Community Memory</Text>
              <Text style={styles.switchHint}>Archive this event after it happens</Text>
            </View>
            <Switch value={addToMemory} onValueChange={setAddToMemory} trackColor={{ true: "#00C6AE" }} />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.createBtn, submitting && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={submitting}
          >
            <Ionicons name="calendar" size={18} color="#FFFFFF" />
            <Text style={styles.createBtnText}>{submitting ? "Creating..." : "Post Gathering"}</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  placeholder: { width: 40 },
  content: { flex: 1, padding: 20 },
  sectionLabel: { fontSize: 15, fontWeight: "600", color: "#0A2342", marginBottom: 10, marginTop: 20 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: { width: "48%", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 2, borderColor: "#E5E7EB", alignItems: "center" },
  typeIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  typeLabel: { fontSize: 13, fontWeight: "600", color: "#0A2342", marginBottom: 2 },
  typeDesc: { fontSize: 11, color: "#9CA3AF", textAlign: "center" },
  input: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, fontSize: 15, color: "#0A2342", borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10 },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  dateRow: { flexDirection: "row", gap: 10 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10 },
  switchLabel: { fontSize: 14, fontWeight: "500", color: "#0A2342" },
  switchHint: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#00C6AE", borderRadius: 14, paddingVertical: 16, marginTop: 24 },
  createBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
